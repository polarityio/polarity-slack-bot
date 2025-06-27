import type { KnownBlock } from '@slack/types';
import { ApiError } from '../polarity';

/**
 * Build a Slack block set that shows a concise error message together with a
 * “Show Error Details” button that opens a modal containing the full metadata.
 */
export function buildErrorBlocks(
  integrationLabel: string,
  err: ApiError
): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:warning: *${integrationLabel}* – ${err.message}`
      }
    },
    {
      type: 'actions',
      block_id: 'error_actions',
      elements: [
        {
          type: 'button',
          action_id: 'show_error_details',
          text: { type: 'plain_text', text: 'Show Error Details' },
          value: JSON.stringify(err.meta).slice(0, 2900) // Slack hard-limit
        }
      ]
    }
  ];
}
