/**
 * Shared type definitions used by multiple modules.
 */



/* -------------------------------------------------------------------------- */
/* Polarity entity helper literal types                                       */
/* -------------------------------------------------------------------------- */

export type PolarityEntityType =
  | 'IPv4'
  | 'IPv6'
  | 'hash'
  | 'string'
  | 'url'
  | 'domain'
  | 'MAC'
  | 'custom'
  | 'email'
  | 'IPv4CIDR';

export type HashType = 'MD5' | 'SHA1' | 'SHA256';

export type IPType = 'IPv4' | 'IPv6' | 'IPv4CIDR';

/* -------------------------------------------------------------------------- */
/* Representation of an entity returned by Polarity                           */
/* -------------------------------------------------------------------------- */

export interface LookupResultEntity {
  /* core identifiers */
  value: string;
  type: PolarityEntityType;
  displayValue: string;

  /* IP-specific metadata */
  IPLong: number;
  IPType: IPType;
  isIP: boolean;
  isIPv4: boolean;
  isIPv6: boolean;
  isPrivateIP: boolean;

  /* attribute flags */
  isDomain: boolean;
  isEmail: boolean;
  isHTMLTag: boolean;
  isHash: boolean;
  isHex: boolean;
  isMD5: boolean;
  isSHA1: boolean;
  isSHA256: boolean;
  isSHA512: boolean;
  isURL: boolean;
  hashType: HashType;

  /* geolocation */
  latitude: number;
  longitude: number;

  /* collections */
  channels: { channel_name: string; id: number }[];
  types: string[];

  /* request context */
  requestContext: {
    isUserInitiated: boolean;
    requestType: string;
    [key: string]: unknown;
  };

  /* catch-all for infrequently-seen keys */
  [key: string]: unknown;
}

/**
 * Lookup result item returned by Polarity integrations.
 * Only the properties used by this Slack bot are typed.
 */
export interface LookupResult {
  entity: LookupResultEntity;
  data: {
    summary: unknown;
    details: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
}

/**
 * Payload shape for the “Save API Token” action submission.
 */
export interface SettingsModalSubmission {
  view: {
    state: {
      values: {
        api_token_block: {
          api_token: {
            value: string;
          };
        };
      };
    };
  };
  user: { id: string };
}

/**
 * Generic Slack body that includes a user object with an `id` property.
 */
export interface SlackBodyWithUser {
  user?: { id?: string };
}

/**
 * Minimal trigger body used by Slack button-action payloads.
 */
export interface SlackTriggerBody {
  trigger_id: string;
}

/**
 * Minimal shape of a Slack view object returned by `views.open`.
 */
export interface SlackView {
  id: string;
  hash: string;
}
