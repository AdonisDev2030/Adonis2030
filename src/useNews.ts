import { useEffect, useRef, useState } from 'react';
import { PROVIDERS, activeProviders, unsupportedReason, type NewsQuery, type Provider } from '../shared/news.ts';
import { initialNewsState, loadProviders, queryParams } from './news';

export function useNews(query: NewsQuery, disabled: boolean, revision: number) {
  const [state, setState] = useState(() => initialNewsState(!disabled));
  const generation = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const cooldowns = useRef<Partial<Record<Provider, number>>>({});
  const params = queryParams(query).toString();
  const selectedProviders = activeProviders(query).join(',');
  const unsupportedNewsApi = unsupportedReason('newsapi', query);

  useEffect(() => {
    const current = ++generation.current;
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
    const controller = new AbortController();
    const runningControllers = controllers.current;
    runningControllers.add(controller);
    const next = initialNewsState(false);
    const providers = disabled
      ? []
      : PROVIDERS.filter((provider) => selectedProviders.split(',').includes(provider));
    const ready = providers.filter((provider) => {
      if (provider === 'newsapi' && unsupportedNewsApi) {
        next[provider] = {
          provider, status: 'unsupported', articles: [], loading: false,
          message: unsupportedNewsApi,
        };
        return false;
      }
      const retryAt = cooldowns.current[provider];
      if (retryAt && retryAt > Date.now()) {
        next[provider] = {
          provider, status: 'rate_limited', articles: [], loading: false, retryAt,
          message: 'This service is temporarily rate limited. Try again after the time shown.',
        };
        return false;
      }
      next[provider].loading = true;
      return true;
    });
    setState(next);
    void loadProviders(
      ready,
      params,
      controller.signal,
      () => current === generation.current,
      (result) => {
        if (result.retryAt) cooldowns.current[result.provider] = result.retryAt;
        else delete cooldowns.current[result.provider];
        setState((previous) => ({ ...previous, [result.provider]: { ...result, loading: false } }));
      },
    ).finally(() => runningControllers.delete(controller));
    return () => {
      for (const active of runningControllers) active.abort();
      runningControllers.clear();
    };
  }, [params, selectedProviders, unsupportedNewsApi, disabled, revision]);

  function retry(provider: Provider) {
    if (state[provider].loading || disabled || unsupportedReason(provider, query)) return;
    if ((cooldowns.current[provider] ?? 0) > Date.now()) return;
    const current = generation.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    setState((previous) => ({ ...previous, [provider]: { ...previous[provider], loading: true } }));
    void loadProviders(
      [provider],
      params,
      controller.signal,
      () => current === generation.current,
      (result) => {
        if (result.retryAt) cooldowns.current[provider] = result.retryAt;
        else delete cooldowns.current[provider];
        setState((previous) => ({ ...previous, [provider]: { ...result, loading: false } }));
      },
    ).finally(() => controllers.current.delete(controller));
  }

  return { state, retry };
}
