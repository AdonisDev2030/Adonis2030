import { isRecord, normalizeUrl, uniqueArticles, unsupportedReason } from '../shared/news.ts';
import type { Article, Category, NewsQuery, ProviderResult } from '../shared/news.ts';
import {
  articleId,
  authorsFor,
  failureResult,
  finish,
  getJson,
  httpUrl,
  isoDate,
  ProviderError,
  publisherFor,
  record,
  SECTIONS,
  text,
} from './common.ts';

const DEFAULT_DOMAINS =
  'bbc.com,bbc.co.uk,reuters.com,apnews.com,cnn.com,theverge.com,wired.com,techcrunch.com,arstechnica.com';

export function normalizeNewsApi(value: unknown, category?: Category): Article | undefined {
  if (!isRecord(value)) return;
  const url = httpUrl(value.url);
  const title = text(value.title);
  if (!url || !title || title === '[Removed]') return;
  const publisher = publisherFor(url, record(value.source).name);
  return {
    id: articleId('newsapi', url),
    provider: 'newsapi',
    publisher,
    title,
    url,
    summary: text(value.description),
    imageUrl: httpUrl(value.urlToImage),
    publishedAt: isoDate(value.publishedAt),
    authors: authorsFor([value.author], publisher),
    categories: category ? [category] : [],
  };
}

function mergeCategories(articles: Article[]): Article[] {
  const categories = new Map<string, Category[]>();
  for (const article of articles) {
    const url = normalizeUrl(article.url);
    categories.set(url, [...new Set([...(categories.get(url) ?? []), ...article.categories])]);
  }
  return uniqueArticles(articles).map((article) => ({
    ...article,
    categories: categories.get(normalizeUrl(article.url)) ?? article.categories,
  }));
}

export async function getNewsApi(
  query: NewsQuery,
  key: string,
  signal: AbortSignal,
): Promise<ProviderResult> {
  const unsupported = unsupportedReason('newsapi', query);
  if (unsupported)
    return {
      provider: 'newsapi',
      status: 'unsupported',
      articles: [],
      message: unsupported,
    };
  const everything =
    !query.categories.length &&
    Boolean(query.q || query.from || query.to || query.publishers.length);
  const categories: (Category | undefined)[] = query.categories.length
    ? query.categories
    : [undefined];
  const results = await Promise.all(
    categories.map(async (category) => {
      const url = new URL(`https://newsapi.org/v2/${everything ? 'everything' : 'top-headlines'}`);
      url.search = new URLSearchParams({ pageSize: '10', page: '1' }).toString();
      if (query.q) url.searchParams.set('q', query.q);
      if (everything) {
        url.searchParams.set('sortBy', 'publishedAt');
        url.searchParams.set('language', 'en');
        if (query.from) url.searchParams.set('from', `${query.from}T00:00:00Z`);
        if (query.to) url.searchParams.set('to', `${query.to}T23:59:59.999Z`);
        if (query.publishers.length)
          url.searchParams.set(
            'domains',
            query.publishers
              .flatMap((domain) => (domain === 'bbc.com' ? ['bbc.com', 'bbc.co.uk'] : [domain]))
              .join(','),
          );
        else if (!query.q) url.searchParams.set('domains', DEFAULT_DOMAINS);
      } else {
        url.searchParams.set('country', 'us');
        if (category) url.searchParams.set('category', SECTIONS[category].newsapi);
      }
      try {
        const data = record(await getJson(url, signal, { 'X-Api-Key': key }));
        if (data.status !== 'ok' || !Array.isArray(data.articles))
          throw new ProviderError('NewsAPI returned an unexpected response.');
        const articles = data.articles
          .map((value) => normalizeNewsApi(value, category))
          .filter((article): article is Article => Boolean(article));
        return finish('newsapi', articles, query);
      } catch (error) {
        if (signal.aborted) throw error;
        return failureResult('newsapi', error);
      }
    }),
  );
  const failures = results.filter((result) => result.status !== 'ok');
  const successful = results.filter((result) => result.status === 'ok');
  if (!successful.length)
    return failures.find((result) => result.status === 'rate_limited') ?? failures[0];
  const result = finish(
    'newsapi',
    mergeCategories(successful.flatMap((value) => value.articles)),
    query,
  );
  if (failures.length) {
    result.status = 'partial';
    result.message = `${failures.length} of ${results.length} category requests failed. Results from the remaining categories are shown. ${failures[0].message ?? ''}`;
    const retryTimes = failures.flatMap((failure) => (failure.retryAt ? [failure.retryAt] : []));
    if (retryTimes.length) result.retryAt = Math.max(...retryTimes);
  }
  return result;
}
