import {
  PROVIDER_NAMES,
  activeProviders,
  unsupportedReason,
  type NewsQuery,
} from '../../shared/news.ts';

interface SelectionNoticeProps {
  query: NewsQuery;
  conflict: boolean;
  personal?: boolean;
}

export function SelectionNotice({ query, conflict, personal = false }: SelectionNoticeProps) {
  const providers = activeProviders(query);
  const unsupported = providers.filter((provider) => unsupportedReason(provider, query));
  if (!conflict && !unsupported.length) return null;
  const available = providers.filter((provider) => !unsupportedReason(provider, query));

  return (
    <p
      className="notice selection-notice my-4 rounded-sm border-l-2 border-accent/40 bg-soft px-4 py-3 text-sm leading-6 text-muted wrap-anywhere"
      role="status"
    >
      {personal && <strong>Your feed: </strong>}
      {conflict ? (
        <>
          Filters and preferences have no sources or topics in common. Adjust either selection
          to receive articles.
        </>
      ) : (
        <>
          {available.length
            ? `${available.map((provider) => PROVIDER_NAMES[provider]).join(' and ')} can be queried. Publishers available only through NewsAPI will be omitted. `
            : 'No service supports this combination. '}
          {unsupportedReason(unsupported[0], query)}{' '}
          Remove Topics, or remove both date and source restrictions
          {personal ? ' from the filters and preferences.' : '.'}
        </>
      )}
    </p>
  );
}
