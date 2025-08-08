import { AllMiddlewareArgs, SlackActionMiddlewareArgs } from '@slack/bolt';
import { errorDetailsCache } from '../cache/error-details-cache';
import type { KnownBlock } from '@slack/types';
import { logger } from '../logger';

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

  const cacheId = typeof (action as { value?: unknown }).value === 'string' ? (action as { value: string }).value : '';

  logger.debug({ cacheId }, 'Loading error from cache');

  const fullText = cacheId ? errorDetailsCache.load(cacheId) : undefined;

  // Helper: split long text into 3 000-character slices (Slack modal limit per section)
  function chunk(text: string, size = 3000): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }

  const MAX_SECTION_TEXT = 2900;
  const MAX_BLOCKS = 100;      // Slack hard-limit
  const MAX_TOTAL_TEXT = 100_000;

  const blocks: KnownBlock[] = [];

  if (!fullText) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          ':warning: These error details have expired and are no longer available.\n' +
          'Please run the lookup again to view fresh error information.'
      }
    });
  } else {
    const raw = fullText.startsWith('```') && fullText.endsWith('```')
      ? fullText.slice(3, -3)
      : fullText;

    let used = 0;

    for (
      let i = 0;
      (i < raw.length || i === 0) && blocks.length < MAX_BLOCKS && used < MAX_TOTAL_TEXT;
      i += MAX_SECTION_TEXT
    ) {
      const slice = raw.slice(i, i + MAX_SECTION_TEXT);
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '```' + slice + '```' }
      });
      used += slice.length;
    }

    if (raw.length > used) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':warning: Output truncated — too large to display fully in Slack.'
        }
      });
    }
  }

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
