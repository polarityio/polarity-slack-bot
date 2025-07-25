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
