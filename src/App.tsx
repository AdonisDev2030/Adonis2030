import { useEffect, useRef, useState } from 'react';
import {
  CATEGORIES,
  EMPTY_PREFERENCES,
  EMPTY_QUERY,
  PROVIDERS,
  activeProviders,
  matchesQuery,
  unsupportedReason,
  uniqueArticles,
  type Author,
  type NewsQuery,
  type Preferences as PreferencesValue,
  type Publisher,
} from '../shared/news.ts';
import { ArticleRow } from '@/components/ArticleRow';
import { Filters } from '@/components/Filters';
import { Preferences } from '@/components/Preferences';
import { SourceStatus } from '@/components/SourceStatus';
import {
  effectiveQuery,
  matchesPreferences,
  readPreferences,
  savePreferences,
} from '@/preferences';
import { useNews } from '@/useNews';

export function App() {
  const [saved, setSaved] = useState(() => {
    try {
      return readPreferences(window.localStorage);
    } catch {
      return {
        preferences: EMPTY_PREFERENCES,
        warning: 'Preferences will only last for this visit; browser storage is unavailable.',
      };
    }
  });
  const [personal, setPersonal] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [query, setQuery] = useState<NewsQuery>(EMPTY_QUERY);
  const [revision, setRevision] = useState(0);
  const filterDetails = useRef<HTMLDetailsElement>(null);
  const [known, setKnown] = useState<{ publishers: Publisher[]; authors: Author[] }>(() => ({
    publishers: saved.preferences.publishers,
    authors: saved.preferences.authors,
  }));
  const effective = effectiveQuery(query, saved.preferences, personal);
  const { state, retry } = useNews(effective.query, effective.conflict, revision);
  const records = PROVIDERS.flatMap((provider) => state[provider].articles);
  const articles = effective.conflict
    ? []
    : uniqueArticles(
        records.filter(
          (article) =>
            matchesQuery(article, effective.query) &&
            (!personal || matchesPreferences(article, saved.preferences)),
        ),
      );
  const providers = activeProviders(effective.query);
  const noSupportedSources = providers.every((provider) =>
    unsupportedReason(provider, effective.query),
  );
  const pending = !effective.conflict && !noSupportedSources &&
    providers.some((provider) => state[provider].loading);
  const problems = providers.filter((provider) => state[provider].status !== 'ok');
  const noKeys =
    !effective.conflict &&
    providers.every((provider) => state[provider].status === 'not_configured');
  const preferenceCount =
    saved.preferences.publishers.length +
    saved.preferences.categories.length +
    saved.preferences.authors.length;

  useEffect(() => {
    const received = PROVIDERS.flatMap((provider) => state[provider].articles);
    if (!received.length) return;
    setKnown((previous) => ({
      publishers: [
        ...new Map(
          [...previous.publishers, ...received.map((article) => article.publisher)].map((item) => [
            item.id,
            item,
          ]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name)),
      authors: [
        ...new Map(
          [...previous.authors, ...received.flatMap((article) => article.authors)].map((item) => [
            item.id,
            item,
          ]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [state]);

  function storePreferences(preferences: PreferencesValue) {
    let warning: string | undefined;
    try {
      warning = savePreferences(window.localStorage, preferences);
    } catch {
      warning = 'Preferences work for this visit, but your browser could not save them.';
    }
    setSaved({ preferences, warning });
    setShowPreferences(false);
  }

  function editFilters() {
    if (filterDetails.current) {
      filterDetails.current.open = true;
      filterDetails.current.querySelector('summary')?.focus();
    }
  }

  return (
    <>
      <a className="skip-link fixed -top-24 left-4 z-50 rounded-md bg-accent px-5 py-3 text-sm text-white focus:top-4" href="#stories">
        Skip to articles
      </a>
      <div className="page-shell mx-auto max-w-6xl px-5 md:px-10">
        <header className="masthead flex items-start justify-between gap-4 border-b border-ink pt-8 pb-7 md:items-center md:pt-12 md:pb-9">
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">Daily Brief</h1>
            <p className="tagline mt-3 max-w-72 text-xs leading-relaxed text-muted md:max-w-none md:text-sm">News from The Guardian, The New York Times and NewsAPI.</p>
          </div>
          <button
            className="preferences-button secondary shrink-0 px-3 text-xs md:px-4 md:text-sm"
            onClick={() => setShowPreferences(true)}
          >
            Preferences
          </button>
        </header>
        <nav className="feed-nav flex gap-7 border-b border-line" aria-label="News views">
          <button className="border-b-2 border-transparent px-1 py-4 text-sm text-muted aria-pressed:border-accent aria-pressed:font-semibold aria-pressed:text-accent" aria-pressed={!personal} onClick={() => setPersonal(false)}>
            All news
          </button>
          <button className="border-b-2 border-transparent px-1 py-4 text-sm text-muted aria-pressed:border-accent aria-pressed:font-semibold aria-pressed:text-accent" aria-pressed={personal} onClick={() => setPersonal(true)}>
            Your feed
          </button>
        </nav>
        <main>
          <Filters
            publishers={known.publishers}
            preferences={saved.preferences}
            personal={personal}
            detailsRef={filterDetails}
            onApply={(value) => {
              setQuery(value);
              setRevision((previous) => previous + 1);
            }}
          />
          {saved.warning && (
            <p className="notice mb-6 rounded-r-md border-l-2 border-accent bg-soft px-4 py-3 text-sm leading-relaxed" role="status">{saved.warning}</p>
          )}
          {personal && (
            <p className="feed-note mb-6 text-sm leading-relaxed text-muted">
              {preferenceCount
                ? 'Your saved preferences apply to this feed.'
                : 'No preferences saved yet. Your feed currently includes all news.'}{' '}
              <button className="text-button" onClick={() => setShowPreferences(true)}>
                {preferenceCount ? 'Edit preferences' : 'Choose preferences'}
              </button>
            </p>
          )}
          <section id="stories" aria-labelledby="stories-title" tabIndex={-1}>
            <div className="section-heading flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="stories-title" className="font-serif text-3xl leading-snug tracking-tight wrap-anywhere">
                {query.q ? `Results for “${query.q}”` : personal ? 'Your feed' : 'Latest news'}
              </h2>
              <span className="result-count shrink-0 text-xs text-muted md:text-sm" role="status">
                {articles.length} {articles.length === 1 ? 'story' : 'stories'} shown
                {pending ? ' · Loading…' : ''}
              </span>
            </div>
            <p className="results-context mt-2 mb-5 max-w-2xl text-xs leading-relaxed text-muted md:text-sm">
              Up to 10 articles per service, newest first. Results are a sample of each service’s matches.
            </p>
            {(query.q ||
              effective.query.from ||
              effective.query.to ||
              effective.query.categories.length > 0 ||
              effective.query.publishers.length > 0) && (
              <div className="applied-filters mb-5 flex flex-wrap gap-2 [&>span]:rounded-md [&>span]:border [&>span]:border-line [&>span]:px-2.5 [&>span]:py-1 [&>span]:text-xs [&>span]:wrap-anywhere" aria-label="Applied filters">
                {query.q && <span>Search: {query.q}</span>}
                {effective.query.from && <span>From {effective.query.from}</span>}
                {effective.query.to && <span>To {effective.query.to}</span>}
                {effective.query.categories.map((id) => (
                  <span key={id}>{CATEGORIES.find((category) => category.id === id)?.label}</span>
                ))}
                {effective.query.publishers.map((id) => (
                  <span key={id}>
                    {known.publishers.find((publisher) => publisher.id === id)?.name ?? id}
                  </span>
                ))}
              </div>
            )}
            {!effective.conflict && <SourceStatus providers={providers} state={state} onRetry={retry} />}
            {effective.conflict ? (
              <div className="empty-state mx-auto max-w-xl px-4 py-14 text-center [&>h3]:mb-3 [&>h3]:font-serif [&>h3]:text-2xl [&>p]:mb-5 [&>p]:text-sm [&>p]:leading-relaxed [&>p]:text-muted">
                <h3>These selections don’t overlap.</h3>
                <p>
                  Your filters and preferences have no sources or topics in common. Clear a filter
                  or adjust your preferences.
                </p>
                <div className="empty-actions flex flex-wrap justify-center gap-3">
                  <button className="secondary" onClick={editFilters}>Edit filters</button>
                  <button className="secondary" onClick={() => setShowPreferences(true)}>
                    Edit preferences
                  </button>
                </div>
              </div>
            ) : noSupportedSources ? (
              <div className="empty-state mx-auto max-w-xl px-4 py-14 text-center [&>h3]:mb-3 [&>h3]:font-serif [&>h3]:text-2xl [&>p]:mb-5 [&>p]:text-sm [&>p]:leading-relaxed [&>p]:text-muted">
                <h3>No service supports this combination.</h3>
                <p>
                  {unsupportedReason('newsapi', effective.query)}{' '}
                  Remove Topics, or remove the date and source restrictions
                  {personal ? ' from your filters and preferences.' : '.'}
                </p>
                <div className="empty-actions flex flex-wrap justify-center gap-3">
                  <button className="secondary" onClick={editFilters}>Edit filters</button>
                  {personal && (
                    <button className="secondary" onClick={() => setShowPreferences(true)}>
                      Edit preferences
                    </button>
                  )}
                </div>
              </div>
            ) : articles.length > 0 ? (
              <div className="article-list">
                {articles.map((article) => (
                  <ArticleRow key={article.id} article={article} />
                ))}
              </div>
            ) : !pending && (
              <div className="empty-state mx-auto max-w-xl px-4 py-14 text-center [&>h3]:mb-3 [&>h3]:font-serif [&>h3]:text-2xl [&>p]:mb-5 [&>p]:text-sm [&>p]:leading-relaxed [&>p]:text-muted">
                <h3>
                  {noKeys
                    ? 'Connect your news sources.'
                    : problems.length === providers.length
                      ? 'The sources could not complete this request.'
                      : 'No matches in these articles.'}
                </h3>
                <p>
                  {noKeys
                    ? 'Add your API keys to the local .env file, then restart the server.'
                    : problems.length === providers.length
                      ? 'Check the source messages above. Adjust the filters or retry when available.'
                      : 'Nothing matches in the received sample. Try fewer filters or different preferences.'}
                </p>
                {personal && !noKeys && (
                  <button className="secondary" onClick={() => setShowPreferences(true)}>
                    Adjust preferences
                  </button>
                )}
              </div>
            )}
            {pending && (
              <div className="skeletons" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <div className="skeleton-row flex gap-8 border-b border-line py-7 motion-safe:animate-pulse" key={index}>
                    <div className="flex-1 space-y-4">
                      <span className="block h-3 w-1/4 rounded bg-line" />
                      <span className="block h-6 w-5/6 rounded bg-line" />
                      <span className="block h-3 w-3/5 rounded bg-line" />
                    </div>
                    <span className="hidden h-32 w-48 rounded-md bg-line md:block" />
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
        <footer className="mt-6 pt-5 pb-8 text-xs leading-relaxed text-muted">Open a headline to read the full article on its publisher’s website.</footer>
      </div>
      {showPreferences && (
        <Preferences
          value={saved.preferences}
          publishers={known.publishers}
          authors={known.authors}
          query={query}
          onSave={storePreferences}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </>
  );
}
