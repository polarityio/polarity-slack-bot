import NodeCache from 'node-cache';
import { randomUUID } from 'node:crypto';

/**
 * In-memory cache for large error details.
 * Entries live for 30 minutes and are cleaned automatically.
 */
const TTL_SECONDS = 30 * 60; // 30 minutes

const cache = new NodeCache<string>({
  stdTTL: TTL_SECONDS,
  checkperiod: 120,
  useClones: false
});

export interface ErrorDetailsCache {
  /** Store the payload and return the generated cache id. */
  save(details: string): string;
  /** Retrieve the payload or `undefined` if expired / missing. */
  load(id: string): string | undefined;
}

export const errorDetailsCache: ErrorDetailsCache = {
  save(details: string): string {
    const id = randomUUID();
    cache.set(id, details);
    return id;
  },
  load(id: string): string | undefined {
    return cache.get(id);
  }
};
