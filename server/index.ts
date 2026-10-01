import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isCategory, isProvider, PROVIDER_NAMES, validateQuery } from '../shared/news.ts';
import type { NewsQuery, Provider } from '../shared/news.ts';
import { canonicalDomain, failureResult } from './common.ts';
import { getGuardian } from './guardian.ts';
import { getNyt } from './nyt.ts';
import { getNewsApi } from './newsapi.ts';

type Keys = Record<Provider, string | undefined>;
const adapters = { guardian: getGuardian, nyt: getNyt, newsapi: getNewsApi };

export function parseQuery(params: URLSearchParams): NewsQuery {
  const allowed = ['q', 'from', 'to', 'categories', 'publishers'];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length > 1)
      throw new Error('Use each supported filter once.');
  }
  const categories = (params.get('categories') ?? '').split(',').filter(Boolean);
  if (categories.some((value) => !isCategory(value)))
    throw new Error('Choose a supported category.');
  const publishers = (params.get('publishers') ?? '').split(',').filter(Boolean);
  if (
    publishers.some(
      (value) =>
        value.length > 253 || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/i.test(value),
    )
  ) {
    throw new Error('Choose valid publisher domains.');
  }
  const query: NewsQuery = {
    q: (params.get('q') ?? '').trim(),
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    categories: [...new Set(categories.filter(isCategory))],
    publishers: [...new Set(publishers.map(canonicalDomain))],
  };
  const error = validateQuery(query);
  if (error) throw new Error(error);
  return query;
}

export function createApp(
  keys: Keys = {
    guardian: process.env.GUARDIAN_API_KEY,
    nyt: process.env.NYT_API_KEY,
    newsapi: process.env.NEWSAPI_KEY,
  },
) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/articles/:provider', async (req, res) => {
    const provider = req.params.provider;
    if (!isProvider(provider)) {
      res.status(400).json({ message: 'Choose a supported news service.' });
      return;
    }
    let query: NewsQuery;
    try {
      query = parseQuery(new URL(req.originalUrl, 'http://localhost').searchParams);
    } catch (error) {
      res
        .status(400)
        .json({ message: error instanceof Error ? error.message : 'Invalid filters.' });
      return;
    }
    const key = keys[provider]?.trim();
    if (!key) {
      res.json({
        provider,
        status: 'not_configured',
        articles: [],
        message: `Configure the API key for ${PROVIDER_NAMES[provider]} in the server environment and restart it.`,
      });
      return;
    }
    const controller = new AbortController();
    const abort = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on('close', abort);
    try {
      const result = await adapters[provider](query, key, controller.signal);
      if (!controller.signal.aborted) res.json(result);
    } catch (error) {
      if (!controller.signal.aborted) res.json(failureResult(provider, error));
    } finally {
      res.off('close', abort);
    }
  });
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Unknown API endpoint.' });
  });
  app.use(express.static(fileURLToPath(new URL('../dist', import.meta.url))));
  app.use((_req, res) => {
    res.status(404).send('Page not found.');
  });
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(new Error('The server could not complete this request.'));
      return;
    }
    const invalidUrl = error instanceof URIError;
    res.status(invalidUrl ? 400 : 500).json({
      message: invalidUrl ? 'The request URL is invalid.' : 'The server could not complete this request.',
    });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? '8080');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be between 1 and 65535.');
  createApp().listen(port, '0.0.0.0', () =>
    console.log(`Daily Brief is available on port ${port}.`),
  );
}
