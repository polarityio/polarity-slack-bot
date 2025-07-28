import type { KnownBlock } from '@slack/types';
import { integrationService } from '../services/integration-service';

interface BuildOptions {
  isAdmin?: boolean;
  /** Grey-out the “Refresh Integrations” button. */
  refreshDisabled?: boolean;
  /** Show an *hourglass* notice while refresh is running. */
  showRefreshingNotice?: boolean;
}

/**
 * Build Home-tab blocks shown in Slack.
 * @param options.isAdmin whether the user is a workspace admin/owner
 */
export function appHomeBlocks(
  { isAdmin = false, refreshDisabled = false, showRefreshingNotice = false }: BuildOptions = {}
): KnownBlock[] {
  const blocks: KnownBlock[] = [];

  if (isAdmin) {
    if (!refreshDisabled) {
      blocks.push({
        type: 'actions',
        block_id: 'refresh_block',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Refresh Integrations' },
            action_id: 'refresh_integrations'
          }
        ]
      });
    }

    if (showRefreshingNotice) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':hourglass_flowing_sand: *Refreshing integrations…*'
          }
        ]
      });
    }
  } else {
    blocks.push({
      type: 'section',
      text: { type: 'plain_text', text: 'Welcome to Polarity' }
    });
  }

  blocks.push(...integrationBlocks());
  return blocks;
}

/* -------------------------------------------------------------------------- */
/*                           internal helper blocks                           */
/* -------------------------------------------------------------------------- */

function integrationBlocks(): KnownBlock[] {
  const integrations = integrationService.list();

  if (integrations.length === 0) {
    return [
      {
        type: 'section',
        text: { type: 'plain_text', text: 'No running integrations configured.' }
      }
    ];
  }

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Running Integrations*' }
    }
  ];

  integrations.forEach((i) =>
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `• ${i.name} (${i.acronym})` }]
    })
  );

  return blocks;
}
