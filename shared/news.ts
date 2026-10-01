export const PROVIDERS = ['guardian', 'nyt', 'newsapi'] as const;
export type Provider = (typeof PROVIDERS)[number];
export const PROVIDER_NAMES: Record<Provider, string> = {
  guardian: 'The Guardian',
  nyt: 'The New York Times',
  newsapi: 'NewsAPI',
};

export const CATEGORIES = [
  { id: 'business', label: 'Business' },
  { id: 'technology', label: 'Technology' },
  { id: 'science', label: 'Science' },
  { id: 'sport', label: 'Sport' },
  { id: 'culture', label: 'Culture' },
] as const;
export type Category = (typeof CATEGORIES)[number]['id'];

export interface Publisher {
  id: string;
  name: string;
  domain: string;
}
export interface Author {
  id: string;
  name: string;
  publisherId: string;
  publisherName: string;
}
export interface Article {
  id: string;
  provider: Provider;
  publisher: Publisher;
  title: string;
  url: string;
  summary?: string;
  imageUrl?: string;
  publishedAt?: string;
  authors: Author[];
  categories: Category[];
}
export interface NewsQuery {
  q: string;
  from: string;
  to: string;
  categories: Category[];
  publishers: string[];
}
export interface Preferences {
  publishers: Publisher[];
  categories: Category[];
  authors: Author[];
}
export type ProviderStatus =
  'ok' | 'partial' | 'not_configured' | 'unsupported' | 'rate_limited' | 'error';
export interface ProviderResult {
  provider: Provider;
  status: ProviderStatus;
  articles: Article[];
  message?: string;
  retryAt?: number;
}

export const EMPTY_QUERY: NewsQuery = { q: '', from: '', to: '', categories: [], publishers: [] };
export const EMPTY_PREFERENCES: Preferences = { publishers: [], categories: [], authors: [] };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isCategory(value: unknown): value is Category {
  return CATEGORIES.some((category) => category.id === value);
}
export function isProvider(value: unknown): value is Provider {
  return PROVIDERS.some((provider) => provider === value);
}
export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateQuery(query: NewsQuery): string | undefined {
  if (query.q.length > 200) return 'Keep your search to 200 characters or fewer.';
  if ((query.from && !isDate(query.from)) || (query.to && !isDate(query.to)))
    return 'Choose a valid date.';
  if (query.from && query.to && query.from > query.to)
    return 'The start date must be on or before the end date.';
}

export function activeProviders(query: NewsQuery): Provider[] {
  return PROVIDERS.filter(
    (provider) =>
      !query.publishers.length ||
      provider === 'newsapi' ||
      query.publishers.includes(provider === 'guardian' ? 'theguardian.com' : 'nytimes.com'),
  );
}

export function unsupportedReason(provider: Provider, query: NewsQuery): string | undefined {
  if (
    provider === 'newsapi' && query.categories.length &&
    (query.from || query.to || query.publishers.length)
  ) {
    return 'NewsAPI does not support topics together with dates or publisher filters.';
  }
}

export function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(key.toLowerCase()))
      url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href;
}

export function matchesQuery(article: Article, query: NewsQuery): boolean {
  if (query.publishers.length && !query.publishers.includes(article.publisher.id)) return false;
  if (
    query.categories.length &&
    !article.categories.some((category) => query.categories.includes(category))
  )
    return false;
  if (query.from || query.to) {
    if (!article.publishedAt || !Number.isFinite(Date.parse(article.publishedAt))) return false;
    const day = new Date(article.publishedAt).toISOString().slice(0, 10);
    if ((query.from && day < query.from) || (query.to && day > query.to)) return false;
  }
  return true;
}

export function uniqueArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  return [...articles]
    .sort((a, b) => {
      const difference =
        (b.publishedAt ? Date.parse(b.publishedAt) : -Infinity) -
        (a.publishedAt ? Date.parse(a.publishedAt) : -Infinity);
      return difference || a.id.localeCompare(b.id);
    })
    .filter((article) => {
      const url = normalizeUrl(article.url);
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}
