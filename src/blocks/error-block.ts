import type { KnownBlock } from '@slack/types';
import { ApiError, parseErrorToReadableJson } from '../errors/api-error';

export function buildErrorBlocksWithTitle(
  integrationName: string,
  integrationAcronym: string,
  err: ApiError,
  entityValue: string,
  entityType: string
): KnownBlock[] {
  return buildBlocks(integrationName, integrationAcronym, err, true, entityValue, entityType);
}

export function buildErrorBlocks(integrationName: string, integrationAcronym: string, err: ApiError): KnownBlock[] {
  return buildBlocks(integrationName, integrationAcronym, err);
}

/**
 * Build a Slack block set that shows a concise error message together with a
 * “Show Error Details” button that opens a modal containing the full metadata.
 */
function buildBlocks(
  integrationName: string,
  integrationAcronym: string,
  err: ApiError,
  includeTitle: boolean = false,
  entityValue: string = '',
  entityType: string = ''
): KnownBlock[] {
  const blocks: KnownBlock[] = [];
  const jsonErr = parseErrorToReadableJson(err);
  const integrationHeader =
    integrationName || integrationAcronym
      ? `*${integrationName}*${integrationAcronym ? ` (${integrationAcronym})` : ''}\n`
      : '';

  // Optional header
  if (includeTitle) {
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: `${entityValue} (${entityType})` }
    });
  }

  const section: KnownBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${integrationHeader}\n_Error: ${jsonErr.message}_`
    }
  };

  // The request here is the request to the `/lookup` endpoint we which don't need for
  // error reporting to the user.
  if (jsonErr.meta && jsonErr.meta.request) {
    delete jsonErr.meta.request;
  }

  // In some cases (like a network error), `meta` will be empty.  In this case we pass through the
  // top level error message.
  if (Object.keys(jsonErr.meta).length === 0) {
    jsonErr.meta.message = jsonErr.message;
  }

  section.accessory = {
    type: 'button',
    text: {
      type: 'plain_text',
      text: ':warning: Show Error Details',
      emoji: true
    },
    action_id: 'show_error_details',
    value: JSON.stringify(jsonErr.meta, null, 2).slice(0, 2000) // Slack hard-limit
  };

  blocks.push(section);

  return blocks;
}
