import { useEffect, useRef, useState } from 'react';
import {
  CATEGORIES,
  EMPTY_PREFERENCES,
  type Author,
  type NewsQuery,
  type Preferences as PreferencesValue,
  type Publisher,
} from '../../shared/news.ts';
import { effectiveQuery } from '../preferences';
import { SelectionNotice } from './SelectionNotice';

interface PreferencesProps {
  value: PreferencesValue;
  publishers: Publisher[];
  authors: Author[];
  query: NewsQuery;
  onSave: (value: PreferencesValue) => void;
  onClose: () => void;
}

export function Preferences({ value, publishers, authors, query, onSave, onClose }: PreferencesProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(value);
  const [authorSearch, setAuthorSearch] = useState('');
  const preview = effectiveQuery(query, draft, true);
  const availableAuthors = authors.filter((author) =>
    author.name.toLocaleLowerCase().includes(authorSearch.toLocaleLowerCase()),
  );

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="preferences m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-ink/40"
      aria-labelledby="preferences-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form
        className="flex max-h-[calc(100dvh-2rem)] flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <div className="dialog-header flex shrink-0 items-center justify-between gap-4 px-5 pt-4 sm:px-7 sm:pt-5">
          <h2 className="font-serif text-3xl leading-tight" id="preferences-title">
            Preferences
          </h2>
          <button
            type="button"
            className="icon-button min-w-11 rounded-md text-3xl text-muted hover:bg-soft hover:text-ink"
            aria-label="Close preferences"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5 sm:px-7">
          <p className="dialog-intro mb-6 mt-2 text-sm leading-relaxed text-muted">
            Choose what you want to see in Your feed. Leave a group empty to include everything in
            that group.
          </p>
          <fieldset className="border-t border-line pb-6 pt-4">
            <legend className="mb-0 pr-3">Sources</legend>
            <p className="field-note mb-2 text-xs leading-relaxed text-muted">
              Choose publishers discovered in your received articles.
            </p>
            {publishers.length ? (
              <div className="checkbox-list preferences-options grid max-h-44 gap-x-4 overflow-y-auto p-1 sm:grid-cols-2">
                {publishers.map((publisher) => (
                  <label
                    className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 py-1 text-sm [overflow-wrap:anywhere]"
                    key={publisher.id}
                  >
                    <input
                      type="checkbox"
                      checked={draft.publishers.some((item) => item.id === publisher.id)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          publishers: event.target.checked
                            ? [...draft.publishers, publisher]
                            : draft.publishers.filter((item) => item.id !== publisher.id),
                        })
                      }
                    />
                    {publisher.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="quiet small text-xs leading-relaxed text-muted">
                Load some articles to discover sources.
              </p>
            )}
          </fieldset>
          <fieldset className="border-t border-line pb-6 pt-4">
            <legend className="mb-0 pr-3">Topics</legend>
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
          <fieldset className="border-t border-line pb-6 pt-4">
            <legend className="mb-0 pr-3">Authors</legend>
            <p className="field-note mb-2 text-xs leading-relaxed text-muted">
              Matches authors within the articles received, not the full archive.
            </p>
            <label className="sr-only" htmlFor="author-search">
              Find an author
            </label>
            <input
              id="author-search"
              className="mb-2 mt-1"
              type="search"
              placeholder="Find an author…"
              value={authorSearch}
              onChange={(event) => setAuthorSearch(event.target.value)}
            />
            {availableAuthors.length ? (
              <div className="checkbox-list preferences-options author-options grid max-h-44 gap-x-4 overflow-y-auto p-1 sm:grid-cols-2">
                {availableAuthors.map((author) => (
                  <label
                    className="flex min-h-11 cursor-pointer items-center gap-2 py-2 text-sm"
                    key={author.id}
                  >
                    <input
                      type="checkbox"
                      checked={draft.authors.some((item) => item.id === author.id)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          authors: event.target.checked
                            ? [...draft.authors, author]
                            : draft.authors.filter((item) => item.id !== author.id),
                        })
                      }
                    />
                    <span className="min-w-0 break-words">
                      {author.name}
                      <small className="mt-1 block text-xs text-muted">{author.publisherName}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="quiet small text-xs leading-relaxed text-muted">
                {authors.length
                  ? 'No known authors match that name.'
                  : 'Authors will appear after articles load.'}
              </p>
            )}
          </fieldset>
          <p className="field-note text-xs leading-relaxed text-muted">
            Your feed matches each selected group together. Preferences are saved only in this
            browser.
          </p>
          <SelectionNotice query={preview.query} conflict={preview.conflict} personal />
        </div>
        <div className="dialog-actions flex shrink-0 flex-col-reverse gap-1 border-t border-line bg-paper px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-7">
          <button
            type="button"
            className="text-button self-start sm:self-auto"
            onClick={() => {
              setDraft(EMPTY_PREFERENCES);
              setAuthorSearch('');
            }}
          >
            Reset preferences
          </button>
          <div className="flex justify-end gap-2">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary">
              Save preferences
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
