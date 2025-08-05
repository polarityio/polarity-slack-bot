import { getRunningIntegrations } from '../polarity';

/**
 * Shape of the attributes we care about from the Polarity “running integrations”
 * endpoint.
 */
interface IntegrationAttributes {
  name?: string;
  acronym?: string;
}

/**
 * Minimal structure of a running integration returned by the Polarity API.
 */
interface PolarityIntegration {
  id: string;
  attributes: IntegrationAttributes;
}

/**
 * Lightweight representation of a cached integration.
 */
export interface CachedIntegration {
  id: string;
  name: string;
  acronym: string;
}

/**
 * A lightweight service providing in-memory caching of running integrations.
 *
 * Export a singleton (`integrationService`) so any module can:
 *   await integrationService.load();          // (re)populate the cache
 *   const one = integrationService.get(id);   // get a single integration
 *   const all = integrationService.list();    // get all cached integrations
 */
class IntegrationService {
  /** Private runtime-enforced cache */
  #cache: Map<string, CachedIntegration> = new Map();

  /**
   * Populate or refresh the cache with data from the Polarity API.
   */
  async load(): Promise<void> {
    const integrations = (await getRunningIntegrations()) as PolarityIntegration[];

    this.#cache.clear();
    integrations.forEach(({ id, attributes }) =>
      this.#cache.set(id, {
        id,
        name: attributes?.name ?? '',
        acronym: attributes?.acronym ?? ''
      })
    );
  }

  /**
   * Retrieve one cached integration by id.
   */
  get(id: string): CachedIntegration | undefined {
    return this.#cache.get(id);
  }

  /**
   * Return all cached integrations as an array.
   */
  list(): CachedIntegration[] {
    return Array.from(this.#cache.values());
  }
}

/** Shared instance; import wherever needed */
export const integrationService = new IntegrationService();
