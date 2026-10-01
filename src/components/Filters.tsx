import { useState, type RefObject } from 'react';
import {
  CATEGORIES,
  EMPTY_QUERY,
  validateQuery,
  type NewsQuery,
  type Preferences,
  type Publisher,
} from '../../shared/news.ts';
import { effectiveQuery } from '../preferences';
import { SelectionNotice } from './SelectionNotice';

interface FiltersProps {
  publishers: Publisher[];
  preferences: Preferences;
  personal: boolean;
  detailsRef: RefObject<HTMLDetailsElement | null>;
  onApply: (query: NewsQuery) => void;
}

export function Filters({ publishers, preferences, personal, detailsRef, onApply }: FiltersProps) {
  const [draft, setDraft] = useState<NewsQuery>(EMPTY_QUERY);
  const [error, setError] = useState<{ message: string; field: 'search' | 'date' }>();
  const preview = effectiveQuery(draft, preferences, personal);

  return (
    <form
      className="filters my-6 rounded-lg border border-line bg-soft/60 px-4 pt-4 sm:px-5 sm:pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        const query = { ...draft, q: draft.q.trim() };
        const message = validateQuery(query);
        setError(message ? { message, field: query.q.length > 200 ? 'search' : 'date' } : undefined);
        if (!message) onApply(query);
      }}
    >
      <label className="search-label mb-2 block text-sm font-semibold" htmlFor="search">
        Search news
      </label>
      <div className="search-row flex gap-2 sm:gap-3">
        <div className="search-input relative min-w-0 flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-3 text-muted"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            id="search"
            className="pl-10"
            type="search"
            placeholder="Enter keywords…"
            value={draft.q}
            maxLength={200}
            aria-invalid={error?.field === 'search' || undefined}
            aria-describedby={error?.field === 'search' ? 'filter-error' : undefined}
            onChange={(event) => {
              setDraft({ ...draft, q: event.target.value });
              if (error?.field === 'search') setError(undefined);
            }}
          />
        </div>
        <button className="primary" type="submit">
          Search
        </button>
      </div>
      <details className="filter-details group" ref={detailsRef}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-sm [&::-webkit-details-marker]:hidden">
          <span>Filters</span>
          <span className="filter-count flex items-center gap-3 text-muted">
            <span className="hidden text-xs sm:inline">Date · Topic · Source</span>
            <span className="inline-block text-base group-open:rotate-180" aria-hidden="true">
              ⌄
            </span>
          </span>
        </summary>
        <div className="filter-fields grid gap-6 border-t border-line py-5 md:grid-cols-2 md:gap-x-8">
          <fieldset>
            <legend>
              Publication date <span className="quiet font-normal text-muted">(UTC)</span>
            </legend>
            <div className="date-range flex gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-2 text-xs text-muted">
                From
                <input
                  type="date"
                  value={draft.from}
                  aria-invalid={error?.field === 'date' || undefined}
                  aria-describedby={error?.field === 'date' ? 'filter-error' : undefined}
                  onChange={(event) => {
                    setDraft({ ...draft, from: event.target.value });
                    if (error?.field === 'date') setError(undefined);
                  }}
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-2 text-xs text-muted">
                To
                <input
                  type="date"
                  value={draft.to}
                  aria-invalid={error?.field === 'date' || undefined}
                  aria-describedby={error?.field === 'date' ? 'filter-error' : undefined}
                  onChange={(event) => {
                    setDraft({ ...draft, to: event.target.value });
                    if (error?.field === 'date') setError(undefined);
                  }}
                />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Topics</legend>
            <div className="checkbox-list topics flex flex-wrap gap-x-5">
              {CATEGORIES.map((category) => (
                <label
                  className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
                  key={category.id}
                >
                  <input
                    type="checkbox"
                    checked={draft.categories.includes(category.id)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        categories: event.target.checked
                          ? [...draft.categories, category.id]
                          : draft.categories.filter((id) => id !== category.id),
                      })
                    }
                  />
                  {category.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="publisher-filter md:col-span-2">
            <legend>Sources</legend>
            <p className="field-note mb-2 text-xs leading-relaxed text-muted">
              Publishers found in your received articles.
            </p>
            {publishers.length ? (
              <div className="checkbox-list source-options grid max-h-44 gap-x-5 overflow-y-auto p-1 sm:grid-cols-2 md:grid-cols-3">
                {publishers.map((publisher) => (
                  <label
                    className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 text-sm [overflow-wrap:anywhere]"
                    key={publisher.id}
                  >
                    <input
                      type="checkbox"
                      checked={draft.publishers.includes(publisher.id)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          publishers: event.target.checked
                            ? [...draft.publishers, publisher.id]
                            : draft.publishers.filter((id) => id !== publisher.id),
                        })
                      }
                    />
                    {publisher.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="quiet small text-xs leading-relaxed text-muted">
                Sources will appear after articles load.
              </p>
            )}
          </fieldset>
          <div className="filter-actions flex items-center justify-end gap-6 md:col-span-2">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setDraft(EMPTY_QUERY);
                setError(undefined);
                onApply(EMPTY_QUERY);
              }}
            >
              Clear filters
            </button>
            <button className="secondary" type="submit">
              Apply filters
            </button>
          </div>
        </div>
      </details>
      {error && (
        <p id="filter-error" role="alert" className="form-error pb-4 text-sm text-[#853a29]">
          {error.message}
        </p>
      )}
      <SelectionNotice query={preview.query} conflict={preview.conflict} personal={personal} />
    </form>
  );
}
