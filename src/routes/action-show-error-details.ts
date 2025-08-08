import { AllMiddlewareArgs, SlackActionMiddlewareArgs } from '@slack/bolt';
import { errorDetailsCache } from '../cache/error-details-cache';
import type { KnownBlock } from '@slack/types';

/**
 * Opens a modal showing the raw metadata captured in {@link ApiError}.
 */
async function actionShowErrorDetails({
  ack,
  body,
  action,
  client
}: SlackActionMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
  await ack();

  const cacheId =
    typeof (action as { value?: unknown }).value === 'string'
      ? (action as { value: string }).value
      : '';

  const fullText = cacheId ? errorDetailsCache.load(cacheId) : undefined;

  // Helper: split long text into 3 000-character slices (Slack modal limit per section)
  function chunk(text: string, size = 3000): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }

  const blocks: KnownBlock[] = fullText
    ? chunk(fullText).map((part) => ({
        type: 'section',
        text: { type: 'mrkdwn', text: '```' + part + '```' }
      }))
    : [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              ':warning: These error details have expired and are no longer available.\n' +
              'Please run the lookup again to view fresh error information.'
          }
        }
      ];

  await client.views.open({
    trigger_id: (body as { trigger_id: string }).trigger_id,
    view: {
      type: 'modal',
      title: {
        type: 'plain_text',
        text: fullText ? 'Error Details' : 'Details Expired'
      },
      close: { type: 'plain_text', text: 'Close' },
      blocks
    }
  });
}

export default actionShowErrorDetails;
