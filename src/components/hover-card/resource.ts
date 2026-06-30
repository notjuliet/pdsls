import { createEffect, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

interface HoverResourceState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface HoverResourceOptions<T> {
  cache?: Map<string, Promise<T>>;
  getErrorMessage?: (err: unknown) => string;
  loadingDelay?: number;
}

const defaultErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Failed to load preview";

const DEFAULT_LOADING_DELAY = 200;

export const createHoverResource = <T>(
  key: Accessor<string | undefined>,
  fetcher: (key: string) => Promise<T>,
  options: HoverResourceOptions<T> = {},
) => {
  const [state, setState] = createSignal<HoverResourceState<T>>({ loading: false });
  const [visibleLoading, setVisibleLoading] = createSignal(false);

  createEffect(() => {
    if (!state().loading) {
      setVisibleLoading(false);
      return;
    }

    const delay = options.loadingDelay ?? DEFAULT_LOADING_DELAY;
    if (delay <= 0) {
      setVisibleLoading(true);
      return;
    }

    const timeout = window.setTimeout(() => setVisibleLoading(true), delay);
    onCleanup(() => window.clearTimeout(timeout));
  });

  const load = () => {
    const currentKey = key();
    if (!currentKey) return;

    const currentState = state();
    if (currentState.loading || currentState.data) return;

    setState({ loading: true });

    let promise = options.cache?.get(currentKey);
    if (!promise) {
      promise = fetcher(currentKey);
      options.cache?.set(currentKey, promise);
      promise.catch(() => options.cache?.delete(currentKey));
    }

    promise.then(
      (data) => {
        if (key() === currentKey) setState({ data, loading: false });
      },
      (err) => {
        if (key() === currentKey) {
          setState({
            loading: false,
            error: (options.getErrorMessage ?? defaultErrorMessage)(err),
          });
        }
      },
    );
  };

  return { state, visibleLoading, load };
};
