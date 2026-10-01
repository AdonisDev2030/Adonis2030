import {
  isCategory,
  isDate,
  isRecord,
  type Article,
  type NewsQuery,
  type Provider,
  type ProviderResult,
} from '../shared/news.ts';
import { isAuthor, isPublisher } from './preferences.ts';

export type ProviderState = ProviderResult & { loading: boolean };
export type NewsState = Record<Provider, ProviderState>;

export function initialNewsState(loading: boolean): NewsState {
  return {
    guardian: { provider: 'guardian', status: 'ok', articles: [], loading },
    nyt: { provider: 'nyt', status: 'ok', articles: [], loading },
    newsapi: { provider: 'newsapi', status: 'ok', articles: [], loading },
  };
}

export function queryParams(query: NewsQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.categories.length) params.set('categories', [...query.categories].sort().join(','));
  if (query.publishers.length) params.set('publishers', [...query.publishers].sort().join(','));
  return params;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isArticle(value: unknown, provider: Provider): value is Article {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    value.provider === provider &&
    isPublisher(value.publisher) &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    isHttpUrl(value.url) &&
    (value.summary === undefined || typeof value.summary === 'string') &&
    (value.imageUrl === undefined || isHttpUrl(value.imageUrl)) &&
    (value.publishedAt === undefined ||
      (typeof value.publishedAt === 'string' &&
        isDate(value.publishedAt.slice(0, 10)) &&
        Number.isFinite(Date.parse(value.publishedAt)))) &&
    Array.isArray(value.authors) &&
    value.authors.every(isAuthor) &&
    Array.isArray(value.categories) &&
    value.categories.every(isCategory)
  );
}

function isProviderResult(value: unknown, provider: Provider): value is ProviderResult {
  return (
    isRecord(value) &&
    value.provider === provider &&
    typeof value.status === 'string' &&
    ['ok', 'partial', 'not_configured', 'unsupported', 'rate_limited', 'error'].includes(
      value.status,
    ) &&
    Array.isArray(value.articles) &&
    value.articles.every((item) => isArticle(item, provider)) &&
    (value.message === undefined || typeof value.message === 'string') &&
    (value.retryAt === undefined ||
      (typeof value.retryAt === 'number' && Number.isFinite(new Date(value.retryAt).getTime())))
  );
}

export async function fetchNews(
  provider: Provider,
  params: string,
  signal: AbortSignal,
): Promise<ProviderResult> {
  const response = await fetch(`/api/articles/${provider}?${params}`, { signal });
  const value: unknown = await response.json();
  if (!response.ok || !isProviderResult(value, provider)) {
    throw new Error('The local server returned an unexpected response.');
  }
  return value;
}

export async function loadProviders(
  providers: readonly Provider[],
  params: string,
  signal: AbortSignal,
  isCurrent: () => boolean,
  onResult: (result: ProviderResult) => void,
  load: typeof fetchNews = fetchNews,
): Promise<void> {
  await Promise.all(
    providers.map(async (provider) => {
      let result: ProviderResult;
      try {
        result = await load(provider, params, signal);
      } catch {
        if (signal.aborted) return;
        result = {
          provider,
          status: 'error',
          articles: [],
          message: 'Could not reach this source. Please try again.',
        };
      }
      if (!signal.aborted && isCurrent()) onResult(result);
    }),
  );
}
