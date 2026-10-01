import { isDate, isRecord, matchesQuery, normalizeUrl, uniqueArticles } from '../shared/news.ts';
import type {
  Article,
  Author,
  Category,
  NewsQuery,
  Provider,
  ProviderResult,
  Publisher,
} from '../shared/news.ts';

export const SECTIONS: Record<Category, { guardian: string[]; nyt: string[]; newsapi: string }> = {
  business: { guardian: ['business'], nyt: ['Business', 'Business Day'], newsapi: 'business' },
  technology: { guardian: ['technology'], nyt: ['Technology'], newsapi: 'technology' },
  science: { guardian: ['science'], nyt: ['Science'], newsapi: 'science' },
  sport: { guardian: ['sport', 'football'], nyt: ['Sports'], newsapi: 'sports' },
  culture: {
    guardian: ['culture', 'film', 'music', 'books', 'stage', 'tv-and-radio'],
    nyt: ['Arts', 'Movies', 'Theater', 'Books'],
    newsapi: 'entertainment',
  },
};

export class ProviderError extends Error {
  status: 'error' | 'rate_limited' | 'unsupported';
  retryAt?: number;
  constructor(message: string, status: ProviderError['status'] = 'error', retryAt?: number) {
    super(message);
    this.status = status;
    this.retryAt = retryAt;
  }
}

export function failureResult(provider: Provider, error: unknown): ProviderResult {
  if (error instanceof ProviderError)
    return {
      provider,
      articles: [],
      status: error.status,
      message: error.message,
      retryAt: error.retryAt,
    };
  return {
    provider,
    articles: [],
    status: 'error',
    message: 'This news service could not be reached. Try again shortly.',
  };
}

export async function getJson(
  url: URL,
  signal: AbortSignal,
  headers?: HeadersInit,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(10_000);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, timeout]),
      headers,
      redirect: 'error',
    });
    if (!response.ok) {
      if (response.status === 429) {
        const retry = response.headers.get('retry-after');
        const timestamp =
          retry && /^\d+(\.\d+)?$/.test(retry)
            ? Date.now() + Number(retry) * 1000
            : Date.parse(retry ?? '');
        throw new ProviderError(
          'Request limit reached. Please wait before trying this service again.',
          'rate_limited',
          Number.isFinite(timestamp) ? Math.max(Date.now(), timestamp) : undefined,
        );
      }
      if (response.status === 401)
        throw new ProviderError(
          'This service could not authenticate the request. Check the server API key.',
        );
      if (response.status === 403)
        throw new ProviderError(
          'This service denied access. Check the API permissions and network access.',
        );
      if (url.hostname === 'newsapi.org' && response.status === 400) {
        const detail: unknown = await response.json().catch(() => undefined);
        if (isRecord(detail) && detail.code === 'parameterInvalid')
          throw new ProviderError(
            'NewsAPI could not serve these filters. Check the date range and your plan’s access.',
            'unsupported',
          );
      }
      throw new ProviderError('This news service returned an error. Try again shortly.');
    }
    try {
      return await response.json();
    } catch {
      throw new ProviderError('This news service returned an unreadable response.');
    }
  } catch (error) {
    if (signal.aborted) throw error;
    if (timeout.aborted)
      throw new ProviderError('This news service took too long to respond. Try again shortly.');
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('This news service could not be reached. Try again shortly.');
  }
}

export function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    copy: '©',
  };
  return (
    value
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
        if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match;
        const point = entity.toLowerCase().startsWith('#x')
          ? parseInt(entity.slice(2), 16)
          : Number(entity.slice(1));
        return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
          ? String.fromCodePoint(point)
          : '';
      })
      .replace(/\s+/g, ' ')
      .trim() || undefined
  );
}

export function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
    return url.href;
  } catch {
    return;
  }
}

export function canonicalDomain(hostname: string): string {
  const domain = hostname.toLowerCase().replace(/^(www\.|m\.)+/, '');
  if (/(^|\.)bbc\.(com|co\.uk)$/.test(domain)) return 'bbc.com';
  if (/(^|\.)(theguardian|guardian)\.com$/.test(domain)) return 'theguardian.com';
  if (/(^|\.)nytimes\.com$/.test(domain)) return 'nytimes.com';
  return domain;
}

export function publisherFor(url: string, name?: unknown): Publisher {
  const domain = canonicalDomain(new URL(url).hostname);
  return { id: domain, domain, name: text(name) ?? domain };
}

export function authorsFor(names: unknown[], publisher: Publisher): Author[] {
  const unique = new Map<string, Author>();
  for (const value of names) {
    const name = text(value)
      ?.replace(/^by\s+/i, '')
      .trim();
    if (!name) continue;
    const id = `${publisher.id}:${name.normalize('NFKC').toLowerCase()}`;
    unique.set(id, { id, name, publisherId: publisher.id, publisherName: publisher.name });
  }
  return [...unique.values()];
}

export function isoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) return;
  if (!isDate(value.slice(0, 10))) return;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return;
  return new Date(parsed).toISOString();
}

export function categoriesFor(value: unknown, provider: 'guardian' | 'nyt'): Category[] {
  if (typeof value !== 'string') return [];
  // Older Guardian records use tvandradio as the section ID.
  const section = value === 'tvandradio' ? 'tv-and-radio' : value;
  return (Object.keys(SECTIONS) as Category[]).filter((category) =>
    SECTIONS[category][provider].includes(section),
  );
}

export function articleId(provider: Provider, url: string): string {
  return `${provider}:${normalizeUrl(url)}`;
}

export function finish(provider: Provider, articles: Article[], query: NewsQuery): ProviderResult {
  return {
    provider,
    status: 'ok',
    articles: uniqueArticles(articles.filter((article) => matchesQuery(article, query))).slice(
      0,
      10,
    ),
  };
}

export function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
