import { useEffect, useState } from 'react';
import { PROVIDER_NAMES, type Provider } from '../../shared/news.ts';
import type { NewsState } from '../news';

interface SourceStatusProps {
  providers: Provider[];
  state: NewsState;
  onRetry: (provider: Provider) => void;
}

export function SourceStatus({ providers, state, onRetry }: SourceStatusProps) {
  const [now, setNow] = useState(Date.now);
  const nextRetry = Math.min(
    ...providers.map((provider) => state[provider].retryAt ?? Infinity).filter((time) => time > now),
  );

  useEffect(() => {
    if (!Number.isFinite(nextRetry)) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(0, nextRetry - Date.now()) + 100, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [nextRetry]);

  return (
    <ul
      className="source-status flex flex-wrap gap-2 border-b border-line pb-5 text-xs leading-5"
      aria-label="News service status"
      aria-live="polite"
    >
      {providers.map((provider) => {
        const result = state[provider];
        const canRetry = ['error', 'rate_limited', 'partial'].includes(result.status);
        const waitingUntil = result.retryAt && result.retryAt > now ? result.retryAt : undefined;
        const healthy = result.status === 'ok';
        return (
          <li
            className={`source-status-row ${healthy ? 'flex flex-wrap items-center gap-x-2 rounded-sm bg-soft px-3 py-1.5' : 'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-sm border border-line bg-white/60 px-3 py-2 sm:grid-cols-[168px_minmax(0,1fr)_auto]'}`}
            key={provider}
          >
            <strong className={`font-medium ${healthy ? 'text-accent' : 'col-span-2 sm:col-span-1'}`}>
              {PROVIDER_NAMES[provider]}
            </strong>
            <span className="source-detail text-muted [overflow-wrap:anywhere]">
              {result.loading
                ? 'Loading…'
                : result.status === 'ok'
                  ? `${result.articles.length} received`
                  : result.message ?? 'This service is unavailable.'}
              {waitingUntil && (
                <small className="block text-xs">
                  Try again after {new Date(waitingUntil).toLocaleTimeString('en-GB')}.
                </small>
              )}
            </span>
            {canRetry && (
              <button
                className="text-button self-start whitespace-nowrap sm:self-center"
                aria-label={`Try ${PROVIDER_NAMES[provider]} again`}
                disabled={Boolean(waitingUntil) || result.loading}
                onClick={() => onRetry(provider)}
              >
                {result.loading ? 'Trying…' : 'Try again'}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
