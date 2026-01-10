import { createStore } from "solid-js/store";

export interface CollectionCacheEntry {
  records: unknown[];
  cursor: string | undefined;
  scrollY: number;
  reverse: boolean;
  limit: number;
}

type RouteCache = Record<string, CollectionCacheEntry>;

const [routeCache, setRouteCache] = createStore<RouteCache>({});

export const getCollectionCache = (key: string): CollectionCacheEntry | undefined => {
  return routeCache[key];
};

export const setCollectionCache = (key: string, entry: CollectionCacheEntry): void => {
  setRouteCache(key, entry);
};

export const clearCollectionCache = (key: string): void => {
  setRouteCache(key, undefined!);
};
