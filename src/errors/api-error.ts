/**
 * Structured error information returned by the Polarity API.
 */
export interface ApiErrorMeta {
  [key: string]: unknown;
}

export interface SerializedIntegrationError {
  /**
   * The name data property of IntegrationError.prototype is shared by all Error instances.
   * It represents the name for the type of error. For IntegrationError.prototype.name,
   * the initial value is "IntegrationError".
   */
  name: string;
  /**
   * The `cause` property is used to specify the `cause` of the error.  Typically,
   * this property is used to pass through a related Error instance.
   */
  cause?: Error;
  /**
   * an optional  meta object containing non-standard meta-information about the error.
   */
  meta?: ApiErrorMeta;
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
    if (meta.cause instanceof Error) {
      this.cause = meta.cause;
      delete meta.cause;
    }
  }

  /**
   * Serializes the error's properties into a POJO.  The order of the
   * properties is preserved when serialized.
   * @returns JSON representation of the error
   */
  toJSON() {
    const props: SerializedIntegrationError = {
      name: this.name
    };

    if (this.meta && Object.keys(this.meta).length > 0) {
      props.meta = this.meta;
    }

    if (this.cause && this.cause instanceof Error) {
      props.cause = parseErrorToReadableJson(this.cause);
    }

    return props;
  }
}

/**
 * @public
 * @param error - Error instance to parse into a plain old javascript object
 */
export const parseErrorToReadableJson = (error: Error) =>
  JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
