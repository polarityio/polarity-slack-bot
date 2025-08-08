import type { KnownBlock, SectionBlock } from '@slack/types';
import type { LookupResult } from '../types';

type WithIntegrationInfo = LookupResult & {
  integrationId?: string;
  integrationName?: string;
  integrationAcronym?: string;
  hasDetails?: boolean;
};

/**
 * Converts Polarity lookup results into Slack Block Kit blocks.
 * Blocks are truncated to stay within Slack's message limits.
 */
/**
 * Includes an entity header (“value (type)”) before the integration results.
 */
export function resultBlocksWithTitle(results: WithIntegrationInfo[]): KnownBlock[] {
  return buildBlocks(results, true);
}

/**
 * Renders only the integration name and summary tags (no entity header).
 */
export function resultBlocks(results: WithIntegrationInfo[]): KnownBlock[] {
  return buildBlocks(results, false);
}

/**
 * Shared renderer used by the two public helpers.
 * When includeTitle is true a header block is added for each entity group.
 */
function buildBlocks(results: WithIntegrationInfo[], includeTitle: boolean): KnownBlock[] {
  const blocks: KnownBlock[] = [];
  const MAX_SECTION_TEXT = 2900; // Slack hard-limit is 3000 chars per section

  /**
   * Group results by entity so we can render a single header followed by all
   * result items (or a “no results” notice) for that entity.
   */
  const groups = new Map<string, { entity: NonNullable<LookupResult['entity']>; items: WithIntegrationInfo[] }>();

  results.forEach((result) => {
    const entity = (result.entity ?? {}) as NonNullable<LookupResult['entity']>;
    const key = `${entity['display-value'] ?? entity.value}|${entity.type ?? 'N/A'}`;
    if (!groups.has(key)) {
      groups.set(key, { entity, items: [] });
    }
    groups.get(key)!.items.push(result);
  });

  // Render each entity group
  groups.forEach(({ entity, items }) => {
    const displayValue = (entity['display-value'] ?? entity.value) || 'Unknown';
    const type = entity.type || 'N/A';

    // Optional header
    if (includeTitle) {
      blocks.push({
        type: 'header',
        text: { type: 'plain_text', text: `${displayValue} (${type})` }
      });
    }

    const itemsWithData = items.filter(hasData);

    // Skip this entity entirely if no integration returned data
    if (itemsWithData.length === 0) {
      return;
    }

    itemsWithData.forEach((result) => {
      const integrationName = result.integrationName ?? '';
      const integrationAcronym = result.integrationAcronym ?? '';
      const integrationHeader =
        integrationName || integrationAcronym
          ? `*${integrationName}*${integrationAcronym ? ` (${integrationAcronym})` : ''}\n`
          : '';

      const summaryArr = (Array.isArray(result.data.summary) ? result.data.summary : []) as SummaryTag[];
      const summaryText =
        summaryArr.length > 0 ? summaryArr.map((tag) => `\`${getSummaryTagText(tag)}\``).join(' ') : '_No summary_';

      // Summary of this particular result with an optional right-aligned details button
      const section: SectionBlock = {
        type: 'section',
        text: { type: 'mrkdwn', text: `${integrationHeader}${summaryText}` }
      };

      if (result.hasDetails) {
        const payload = JSON.stringify({
          integrationId: result.integrationId,
          entity: {
            value: entity.value,
            type: entity.type
          }
        });

        section.accessory = {
          type: 'button',
          text: { type: 'plain_text', text: 'Show Details' },
          action_id: 'show_details',
          value: payload
        };
      }

      blocks.push(section);
    });

    // Divider between entities
    blocks.push({ type: 'divider' });
  });

  // Remove the trailing divider for cleaner output
  if (blocks.at(-1)?.type === 'divider') blocks.pop();

  return blocks;
}

interface SummaryTagObject {
  text?: string;

  [key: string]: unknown;
}

type SummaryTag = string | SummaryTagObject;

/**
 * Type guard ensuring a lookup result definitely contains data.
 */
function hasData(
  r: WithIntegrationInfo
): r is WithIntegrationInfo & { data: NonNullable<WithIntegrationInfo['data']> } {
  return r.data !== null;
}

function removeImageFromString(value: string) {
  return value.replace(/<svg.+<\/svg>/g, '').replace(/<img.+<\/img>/g, '');
}

/**
 * Attempts to extract the text from a tag as some tags are objects
 * @param tag
 */
function getSummaryTagText(tag: SummaryTag): string {
  if (typeof tag === 'string') {
    return removeImageFromString(tag).trim();
  }

  if (tag && typeof tag === 'object' && typeof tag.text === 'string') {
    return removeImageFromString(tag.text).trim();
  }

  // Fallback if tag is not a string or object with text property
  return 'Tag unavailable';
}
