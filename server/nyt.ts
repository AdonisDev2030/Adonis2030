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

function imageUrl(multimedia: unknown): string | undefined {
  const media = record(multimedia);
  const candidates = Array.isArray(multimedia)
    ? multimedia.flatMap((item) => {
        const mediaItem = record(item);
        return [item, mediaItem.default, mediaItem.thumbnail];
      })
    : [media.default, media.thumbnail];
  for (const candidate of candidates) {
    const value = record(candidate).url;
    if (typeof value !== 'string' || !value.trim()) continue;
    const url =
      httpUrl(value) ??
      (value.startsWith('images/') ? httpUrl(`https://www.nytimes.com/${value}`) : undefined);
    if (url) return url;
  }
}

export function normalizeNyt(value: unknown): Article | undefined {
  if (!isRecord(value)) return;
  const url = httpUrl(value.web_url);
  const title = text(record(value.headline).main);
  if (!url || !title) return;
  const publisher = publisherFor(url, 'The New York Times');
  const byline = record(value.byline);
  const people = Array.isArray(byline.person)
    ? byline.person
        .filter(isRecord)
        .map((person) =>
          [person.firstname, person.middlename, person.lastname]
            .map(text)
            .filter(Boolean)
            .join(' '),
        )
    : [];
  const authors = authorsFor(people, publisher);
  return {
    id: articleId('nyt', url),
    provider: 'nyt',
    publisher,
    title,
    url,
    summary: text(value.abstract) ?? text(value.snippet),
    imageUrl: imageUrl(value.multimedia),
    publishedAt: isoDate(value.pub_date),
    authors: authors.length ? authors : authorsFor([byline.original], publisher),
    categories: categoriesFor(value.section_name, 'nyt'),
  };
}

export async function getNyt(
  query: NewsQuery,
  key: string,
  signal: AbortSignal,
): Promise<ProviderResult> {
  if (query.publishers.length && !query.publishers.includes('nytimes.com'))
    return finish('nyt', [], query);
  const url = new URL('https://api.nytimes.com/svc/search/v2/articlesearch.json');
  const sections = query.categories.flatMap((category) => SECTIONS[category].nyt);
  const fq =
    'source.vernacular:("The New York Times")' +
    (sections.length
      ? ` AND section.name:(${sections.map((section) => `"${section}"`).join(', ')})`
      : '');
  url.search = new URLSearchParams({ 'api-key': key, sort: 'newest', page: '0', fq }).toString();
  if (query.q) url.searchParams.set('q', query.q);
  if (query.from) url.searchParams.set('begin_date', query.from.replaceAll('-', ''));
  if (query.to) url.searchParams.set('end_date', query.to.replaceAll('-', ''));
  const data = record(await getJson(url, signal));
  const response = record(data.response);
  if (data.status !== 'OK' || !Array.isArray(response.docs))
    throw new ProviderError('The New York Times returned an unexpected response.');
  const articles = response.docs
    .map(normalizeNyt)
    .filter((article): article is Article => Boolean(article));
  return finish('nyt', articles, query);
}
