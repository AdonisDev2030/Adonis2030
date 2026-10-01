import { isRecord } from '../shared/news.ts';
import type { Article, NewsQuery, ProviderResult } from '../shared/news.ts';
import {
  articleId,
  authorsFor,
  categoriesFor,
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

export function normalizeGuardian(value: unknown): Article | undefined {
  if (!isRecord(value)) return;
  const url = httpUrl(value.webUrl);
  const title = text(value.webTitle);
  if (!url || !title) return;
  const fields = record(value.fields);
  const publisher = publisherFor(url, 'The Guardian');
  const contributors = Array.isArray(value.tags)
    ? value.tags
        .filter(isRecord)
        .filter((tag) => tag.type === 'contributor')
        .map((tag) => tag.webTitle)
    : [];
  const authors = authorsFor(contributors, publisher);
  return {
    id: articleId('guardian', url),
    provider: 'guardian',
    publisher,
    title,
    url,
    summary: text(fields.trailText),
    imageUrl: httpUrl(fields.thumbnail),
    publishedAt: isoDate(value.webPublicationDate),
    authors: authors.length ? authors : authorsFor([fields.byline], publisher),
    categories: categoriesFor(value.sectionId, 'guardian'),
  };
}

export async function getGuardian(
  query: NewsQuery,
  key: string,
  signal: AbortSignal,
): Promise<ProviderResult> {
  if (query.publishers.length && !query.publishers.includes('theguardian.com'))
    return finish('guardian', [], query);
  const url = new URL('https://content.guardianapis.com/search');
  url.search = new URLSearchParams({
    'api-key': key,
    'page-size': '10',
    page: '1',
    'order-by': 'newest',
    'show-fields': 'trailText,thumbnail,byline',
    'show-tags': 'contributor',
  }).toString();
  if (query.q) url.searchParams.set('q', query.q);
  if (query.from) url.searchParams.set('from-date', query.from);
  if (query.to) url.searchParams.set('to-date', query.to);
  if (query.categories.length)
    url.searchParams.set(
      'section',
      query.categories.flatMap((category) => SECTIONS[category].guardian).join('|'),
    );
  const data = record(await getJson(url, signal));
  const response = record(data.response);
  if (response.status !== 'ok' || !Array.isArray(response.results))
    throw new ProviderError('The Guardian returned an unexpected response.');
  const articles = response.results
    .map(normalizeGuardian)
    .filter((article): article is Article => Boolean(article));
  return finish('guardian', articles, query);
}
