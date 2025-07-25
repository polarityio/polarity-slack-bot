/**
 * Utility functions to interact with the Polarity REST API.
 *
 * Environment Variables (all are required unless noted):
 *  - POLARITY_URL                 The base URL of the Polarity server, e.g. https://polarity.mycompany.com
 *  - POLARITY_TOKEN               A valid bearer token for the Polarity REST API.
 *  - POLARITY_IGNORE_TLS_ERRORS   If set to the string "true", TLS certificate errors will be ignored.
 *
 * Node 18+ provides a global `fetch` implementation so no external dependency is needed.
 */

import { createProxyDispatcher } from './proxy';
import type { LookupResult, LookupResultEntity } from './types';
import {logger} from "./logger";
import { HeadersInit } from 'undici-types';

const DISPATCHER = createProxyDispatcher();
const POLARITY_URL = `https://${process.env.POLARITY_HOSTNAME}`;
const POLARITY_TOKEN = process.env.POLARITY_API_KEY;

if (!POLARITY_URL) {
  throw new Error('Environment variable POLARITY_URL is required');
}

if (!POLARITY_TOKEN) {
  throw new Error('Environment variable POLARITY_TOKEN is required');
}

/**
 * Structured error information returned by the Polarity API.
 */
export interface ApiErrorMeta {
  [key: string]: unknown;
}

/**
 * Error thrown when the Polarity API responds with a non-2xx status.
 * Carries both the user-friendly message and the raw metadata.
 */
export class ApiError extends Error {
  public readonly meta: ApiErrorMeta;

  constructor(message: string, meta: ApiErrorMeta = {}) {
    super(message);
    this.name = 'ApiError';
    this.meta = meta;
  }
}

/**
 * Remove sensitive data (e.g. tokens) from headers before logging.
 */
function sanitizeHeaders(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) return;
  const all =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : { ...headers } as Record<string, string>;

  const auth = all.Authorization ?? all.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    all.Authorization = `Bearer ${auth.slice(7, 11)}…redacted`;
  }
  return all;
}

/**
 * Convert an HTTP error response into a rich {@link ApiError}.
 */
async function throwIfHttpError(
  response: Response,
  url: string,
  init: RequestInit
): Promise<void> {
  if (response.ok) return;

  let meta: ApiErrorMeta = {};
  let message = `${response.status} ${response.statusText}`;

  try {
    const body = (await response.json()) as { errors?: unknown[] };
    const first = body.errors?.[0] as Record<string, unknown> | undefined;
    if (first) {
      meta = first;
      const inner =
        (first.meta as { errors?: { detail?: string }[] } | undefined)?.errors?.[0]
          ?.detail;
      message = inner ?? (first.detail as string | undefined) ?? message;
    }
  } catch {
    /* ignore JSON-parse errors */
  }

  throw new ApiError(message, {
    ...meta,
    request: {
      url,
      method: init.method ?? 'GET',
      headers: sanitizeHeaders(init.headers),
      // body is not part of RequestInit in @types/undici; cast to access it
      body: (init as { body?: unknown }).body
    }
  });
}

export interface ParsedEntity {
  type: string;
  value: string;

  /** Additional properties returned by the API are captured using an index signature. */
  [key: string]: unknown;
}

/**
 * Sets NODE_TLS_REJECT_UNAUTHORIZED to "0" when the user explicitly requests to
 * ignore TLS errors via the POLARITY_IGNORE_TLS_ERRORS environment variable.
 * This is the simplest cross-platform way to relax TLS verification when
 * calling fetch() in Node.
 */
function ignoreTlsErrorsIfNeeded(): void {
  if (process.env.POLARITY_IGNORE_TLS_ERRORS === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
}

/**
 * Calls the `/api/parsed-entities` endpoint to convert an arbitrary block of
 * text into an array of Polarity Parsed Entity Objects.
 *
 * Equivalent cURL:
 *   curl -X POST "$POLARITY_URL/api/parsed-entities" \
 *        -H "Authorization: Bearer $POLARITY_TOKEN" \
 *        -H "Content-Type: application/vnd.api+json" \
 *        --data '{"data":{"attributes":{"text":"<TEXT_TO_PARSE>"}}}'
 *
 * @param text A string that may contain one or more entities (IP, domain, etc.)
 * @returns A Promise that resolves to an array of ParsedEntity objects.
 */
export async function parseEntities(text: string): Promise<ParsedEntity[]> {
  ignoreTlsErrorsIfNeeded();

  const url = `${POLARITY_URL}/api/parsed-entities`;
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POLARITY_TOKEN}`,
      'Content-Type': 'application/vnd.api+json'
    },
    body: JSON.stringify({
      data: {
        attributes: { text }
      }
    }),
    ...(DISPATCHER ? { dispatcher: DISPATCHER } : {})
  };

  const response = await fetch(url, requestInit);
  await throwIfHttpError(response, url, requestInit);

  const body = (await response.json()) as {
    data?: { attributes?: { entities?: ParsedEntity[] } };
  };

  return body?.data?.attributes?.entities ?? [];
}

/**
 * Convenience helper that:
 *  1. Parses the provided text into entity objects.
 *  2. Looks up those entities against the `maxmind` Polarity integration.
 *
 * @param text The raw text to parse and then look up.
 * @param integrationId The Polarity integration ID to perform the lookup against.
 * @returns A Promise that resolves to an array of IntegrationLookupResult
 *          objects (one per entity). If no entities are found, an empty array
 *          is returned.
 */
/**
 * Looks up an array of already-parsed entities against the specified Polarity
 * integration.
 *
 * @param entities      Parsed entities to look up.
 * @param integrationId Polarity integration ID to query.
 */
export interface IntegrationLookupResponse {
  searchedEntities: LookupResultEntity[];
  results: LookupResult[];
}

export async function lookup(entities: ParsedEntity[], integrationId: string): Promise<IntegrationLookupResponse> {
  if (entities.length === 0) {
    return {
      searchedEntities: [],
      results: []
    };
  }

  ignoreTlsErrorsIfNeeded();

  const url = `${POLARITY_URL}/api/integrations/${encodeURIComponent(integrationId)}/lookup`;
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POLARITY_TOKEN}`,
      'Content-Type': 'application/vnd.api+json'
    },
    body: JSON.stringify({
      data: {
        type: 'integration-lookups',
        attributes: {
          entities
        }
      }
    }),
    ...(DISPATCHER ? { dispatcher: DISPATCHER } : {})
  };

  const response = await fetch(url, requestInit);
  await throwIfHttpError(response, url, requestInit);

  const body = (await response.json()) as {
    data?: { attributes?: { results?: LookupResult[]; entities?: LookupResultEntity[] } };
  };

  const attrs = body?.data?.attributes ?? {};

  return {
    searchedEntities: attrs.entities ?? [],
    results: attrs.results ?? []
  };
}

/**
 * Convenience helper that:
 *  1. Parses the provided text into entity objects.
 *  2. Delegates to `lookup` to query a specific integration.
 */
export async function lookupText(text: string, integrationId: string): Promise<IntegrationLookupResponse> {
  const entities = await parseEntities(text);
  return lookup(entities, integrationId);
}

/**
 * Fetch all integrations currently in the `running` state.
 *
 * GET https://<POLARITY_HOST>/api/integrations
 *      ?filter[integration.status]=running
 *      &page[size]=300
 *
 * @returns A Promise that resolves to an array of integration objects.
 */
export async function getRunningIntegrations(): Promise<unknown[]> {
  ignoreTlsErrorsIfNeeded();

  const url = new URL(`${POLARITY_URL}/api/integrations`);
  url.searchParams.set('filter[integration.status]', 'running');
  url.searchParams.set('page[size]', '300');

  const requestInit: RequestInit = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${POLARITY_TOKEN}`,
      'Content-Type': 'application/vnd.api+json'
    },
    ...(DISPATCHER ? { dispatcher: DISPATCHER } : {})
  };

  const response = await fetch(url.toString(), requestInit);
  await throwIfHttpError(response, url.toString(), requestInit);

  const body = (await response.json()) as { data?: unknown[] };
  return body.data ?? [];
}
