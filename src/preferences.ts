import {
  EMPTY_PREFERENCES,
  isCategory,
  isRecord,
  type Article,
  type Author,
  type NewsQuery,
  type Preferences,
  type Publisher,
} from '../shared/news.ts';

export const STORAGE_KEY = 'daily-brief-preferences';

export function isPublisher(value: unknown): value is Publisher {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.domain === 'string' &&
    /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value.domain) &&
    value.id === value.domain &&
    value.name.trim().length > 0
  );
}
export function isAuthor(value: unknown): value is Author {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.publisherId === 'string' &&
    typeof value.publisherName === 'string' &&
    value.id.trim().length > 0 &&
    value.name.trim().length > 0 &&
    value.publisherId.trim().length > 0 &&
    value.publisherName.trim().length > 0
  );
}

export function readPreferences(storage: Pick<Storage, 'getItem'>): {
  preferences: Preferences;
  warning?: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { preferences: EMPTY_PREFERENCES };
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      !Array.isArray(value.publishers) ||
      !value.publishers.every(isPublisher) ||
      !Array.isArray(value.categories) ||
      !value.categories.every(isCategory) ||
      !Array.isArray(value.authors) ||
      !value.authors.every(isAuthor)
    )
      throw new Error('Invalid preferences');
    return {
      preferences: {
        publishers: value.publishers,
        categories: value.categories,
        authors: value.authors,
      },
    };
  } catch {
    return {
      preferences: EMPTY_PREFERENCES,
      warning: 'Your saved preferences could not be read. You can choose them again.',
    };
  }
}

export function savePreferences(
  storage: Pick<Storage, 'setItem'>,
  preferences: Preferences,
): string | undefined {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    return 'Preferences work for this visit, but your browser could not save them.';
  }
}

function intersectSelections<T extends string>(filters: T[], preferences: T[]): T[] {
  if (!filters.length) return preferences;
  if (!preferences.length) return filters;
  return filters.filter((value) => preferences.includes(value));
}

export function effectiveQuery(
  query: NewsQuery,
  preferences: Preferences,
  personal: boolean,
): { query: NewsQuery; conflict: boolean } {
  if (!personal) return { query, conflict: false };
  const sources = preferences.publishers.map((publisher) => publisher.id);
  const publishers = intersectSelections(query.publishers, sources);
  const categories = intersectSelections(query.categories, preferences.categories);
  const conflict = Boolean(
    (query.publishers.length && sources.length && !publishers.length) ||
    (query.categories.length && preferences.categories.length && !categories.length),
  );
  return { query: { ...query, publishers, categories }, conflict };
}

export function matchesPreferences(article: Article, preferences: Preferences): boolean {
  return (
    (!preferences.publishers.length ||
      preferences.publishers.some((publisher) => publisher.id === article.publisher.id)) &&
    (!preferences.categories.length ||
      article.categories.some((category) => preferences.categories.includes(category))) &&
    (!preferences.authors.length ||
      article.authors.some((author) =>
        preferences.authors.some((preferred) => preferred.id === author.id),
      ))
  );
}
