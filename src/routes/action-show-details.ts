import { SlackTriggerBody, SlackView } from '../types';
import { lookupText } from '../polarity';
import { logger } from '../logger';
import { integrationService } from '../services/integration-service';
import type { KnownBlock } from '@slack/types';
import type { AllMiddlewareArgs, BlockAction, SlackActionMiddlewareArgs } from '@slack/bolt';

/**
 * Opens a modal that displays the JSON `detailsText` when the user presses the
 * “Show Details” button in a message.
 */
async function actionShowDetails({
  ack,
  body,
  action,
  client
}: SlackActionMiddlewareArgs<BlockAction> & AllMiddlewareArgs) {
  // Always acknowledge the action payload first
  await ack();

  const triggerId = (body as SlackTriggerBody).trigger_id;

  const { integrationId, entity } = JSON.parse((action as { type: 'button'; value: string }).value);

  /**
   * ────────────────────────────────────────────────────────────────────────────────
   * Consume the trigger_id immediately by opening a lightweight placeholder modal.
   * Slack invalidates trigger_ids ~3 s after sending them, so performing the
   * network-heavy Polarity lookup *before* opening the modal frequently led to
   * “expired_trigger_id” errors.  We now:
   *
   *   1. Open a “Fetching details…” modal within the 3-second window.
   *   2. Perform the (potentially slow) lookup.
   *   3. Update the modal with the real details.
   * ────────────────────────────────────────────────────────────────────────────────
   */
  const loading = await client.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      title: { type: 'plain_text', text: 'Integration Details' },
      close: { type: 'plain_text', text: 'Close' },
      blocks: [
        {
          type: 'section',
          text: { type: 'plain_text', text: 'Fetching details…' }
        }
      ]
    }
  });

  // Default message in case we cannot fetch fresh details
  let detailsText = '_No details found_';

  try {
    // Re-run the lookup for just this entity on the specific integration
    const { results: freshResults } = await lookupText(entity.value, integrationId);
    const match = freshResults.find((r) => r.entity.value === entity.value && r.entity.type === entity.type);

    if (match?.data?.details && Object.keys(match.data.details).length > 0) {
      detailsText = '```' + JSON.stringify(match.data.details, null, 2) + '```';
    }
  } catch (err) {
    logger.error({ err }, 'Failed to fetch fresh details');
    detailsText = ':warning: Failed to fetch details';
  }

  const integration = integrationService.get(integrationId);
  const headerText =
    integration && (integration.name || integration.acronym)
      ? `${integration.name}${integration.acronym ? ` (${integration.acronym})` : ''}`
      : 'Integration Details';

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: headerText }
    }
  ];

  // Slack limits a section's text to 3000 characters.
  // Chunk the details into ~2900-char slices (leaving head-room) and render
  // one section per slice so very large payloads are displayed fully.
  const MAX_SECTION_TEXT = 2900;

  const isCodeBlock = detailsText.startsWith('```') && detailsText.endsWith('```');
  // Remove the surrounding ``` fences when chunking, re-add per slice later.
  const rawText = isCodeBlock ? detailsText.slice(3, -3) : detailsText || '_No details found_';

  for (let i = 0; i < rawText.length || i === 0; i += MAX_SECTION_TEXT) {
    const slice = rawText.slice(i, i + MAX_SECTION_TEXT);
    const sectionText = isCodeBlock ? `\`\`\`${slice}\`\`\`` : slice || '_No details found_';

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: sectionText }
    });
  }

  // Update the modal opened earlier with the real details
  if (loading.view && 'id' in loading.view && 'hash' in loading.view) {
    const { id: viewId, hash } = loading.view as SlackView;
    await client.views.update({
      view_id: viewId,
      hash,
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: 'Integration Details' },
        close: { type: 'plain_text', text: 'Close' },
        blocks
      }
    });
  }
}

export default actionShowDetails;
