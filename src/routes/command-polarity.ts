import { lookup, type ParsedEntity, parseEntities } from '../polarity';
import { logger } from '../logger';
import type { KnownBlock } from '@slack/types';
import { resultBlocks, resultBlocksWithTitle } from '../blocks/result-block';
import { integrationService } from '../services/integration-service';
import { AllMiddlewareArgs, type SlackCommandMiddlewareArgs } from '@slack/bolt';
import { LookupResult } from '../types';
import { createMessenger, type SendFn } from '../utils/slack-messenger';
import { ProgressBar } from '../blocks/progress-bar';
import { ApiError } from '../polarity';
import { buildErrorBlocks } from '../blocks/error-block';

async function commandPolarity({ ack, command, client }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
  // Note, based on this StackOverflow post you cannot replace_original when it comes to
  // command messages (only action message):
  // https://stackoverflow.com/questions/71940100/cannot-replace-or-delete-the-response-to-slack-slash-command
  // this means any content we return will stay in Slack and cannot be updated.
  const searchText = command.text?.trim();
  const channelId = command.channel_id;
  const send = createMessenger(client, channelId);

  await ack();

  // Ensure the bot is in the channel so it can post messages
  try {
    await client.conversations.join({ channel: channelId });
  } catch (err) {
    const errorCode = (err as { data?: { error?: string } }).data?.error;
    if (errorCode !== 'already_in_channel' && errorCode !== 'method_not_supported_for_dm') {
      logger.warn({ err, channelId }, 'Failed to join channel');
    }
  }

  if (!searchText) {
    await send({
      text: 'Please provide search text after the command, e.g., `/polarity 8.8.8.8`',
      response_type: 'ephemeral',
      userId: command.user_id
    });
    return;
  }

  const integrations = integrationService.list();

  // If no integrations are cached, inform the user and exit early
  if (integrations.length === 0) {
    await send({
      text: 'No integrations are currently configured for the Polarity Bot.',
      response_type: 'ephemeral'
    });
    return;
  }

  // Create and display a progress bar that will be updated as lookups complete
  const totalIntegrations = integrations.length;
  const progressBar = new ProgressBar({
    send,
    label: 'Parsing search text',
    total: totalIntegrations,
    options: {
      width: 40
    }
  });
  await progressBar.update(0);

  try {
    // Parse entities only once
    const parsedEntities = await parseEntities(searchText);
    logger.trace({ parsedEntities }, `Parsed Entities Result`);
    await progressBar.setLabel(`Searching ${totalIntegrations} integrations`);

    if (parsedEntities.length === 0) {
      await send({
        text: 'No entities found in the provided text.'
      });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // If more than one unique entity value was found, group results per entity
    // before replying.
    // ────────────────────────────────────────────────────────────────────────────
    const uniqueValues = new Set(parsedEntities.map((e) => e.value));
    const isMultiEntitySearch = uniqueValues.size > 1;
    if (isMultiEntitySearch) {
      logger.trace('Responding for multiple entities');
      await respondGroupedEntities(send, parsedEntities, progressBar);
    } else {
      logger.trace('Responding for single entity');
      await respondSingleEntity(send, parsedEntities, progressBar);
    }
  } catch (error) {
    logger.error({ error }, 'Polarity lookup failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    await send({
      text: `:warning: Error: ${message}`
    });
  } finally {
    try {
      await progressBar.destroy();
    } catch {
      /* ignore errors */
    }
  }
}

/**
 * Stand-alone helper for the single-entity workflow (one unique entity value).
 */
interface WithIntegrationInfo extends LookupResult {
  integrationId?: string;
  integrationName?: string;
  integrationAcronym?: string;
  hasDetails?: boolean;
}

async function respondSingleEntity(
  send: SendFn,
  parsedEntities: ParsedEntity[],
  progressBar: ProgressBar
): Promise<void> {
  let firstResponseSent = false;
  let completed = 0;

  // Fire a lookup for each integration and collect promises so we can send a final summary
  const lookupPromises = integrationService.list().map((meta) =>
    (async (): Promise<void> => {
      const id = meta.id;
      try {
        const { results: lookupResults } = await lookup(parsedEntities, id);

        const results: WithIntegrationInfo[] = lookupResults.map((lookupResult) => {
          const hasDetails = !!lookupResult.data?.details && Object.keys(lookupResult.data.details).length > 0;

          /* ignore null results – we only show integrations that return data */

          // Strip heavy details; keep empty `details` for type safety
          const slimData =
            lookupResult.data === null
              ? null
              : {
                  ...lookupResult.data,
                  details: {} as Record<string, unknown>
                };

          return {
            ...lookupResult,
            data: slimData,
            hasDetails,
            integrationId: id,
            integrationName: meta.name,
            integrationAcronym: meta.acronym
          };
        });

        const blocks: KnownBlock[] = firstResponseSent
          ? resultBlocks(results)
          : ((firstResponseSent = true), resultBlocksWithTitle(results));

        if (blocks.length === 0) {
          return;
        }

        await send({
          text: `Polarity results – ${meta.name || meta.acronym || id}`,
          blocks
        });
        return;
      } catch (err) {
        logger.error({ err, integrationId: id }, `Lookup failed for integration ${id}`);
        if (err instanceof ApiError) {
          await send({
            text: `:warning: ${meta.name || meta.acronym || id} lookup failed – ${err.message}`,
            blocks: buildErrorBlocks(meta.name || meta.acronym || id, err)
          });
        } else {
          const message = err instanceof Error ? err.message : 'Unknown error';
          await send({
            text: `:warning: ${meta.name || meta.acronym || id} lookup failed – ${message}`
          });
        }
        return;
      }
    })().finally(async () => {
      completed += 1;
      await progressBar.update(completed);
    })
  );

  // Wait for all lookups to complete so we can summarise
  await Promise.all(lookupPromises);

  await send({
    text: 'All integration lookups completed – results above.'
  });
}

/**
 * Responds with one Slack message per entity when multiple entities are parsed.
 * All integration lookup results are grouped together before sending.
 */
async function respondGroupedEntities(
  send: SendFn,
  parsedEntities: ParsedEntity[],
  progressBar: ProgressBar
): Promise<void> {
  type WithIntegrationInfo = LookupResult & {
    integrationId?: string;
    integrationName?: string;
    integrationAcronym?: string;
    hasDetails?: boolean;
  };

  const resultsByEntity = new Map<string, WithIntegrationInfo[]>();

  let completed = 0;

  // Run all integration lookups in parallel but only collect results
  const lookupPromises = integrationService.list().map((meta) =>
    (async (): Promise<void> => {
      const id = meta.id;
      try {
        const { searchedEntities, results: lookupResults } = await lookup(parsedEntities, id);

        lookupResults.forEach((lookupResult) => {
          const hasDetails = !!lookupResult.data?.details;

          /* ignore null results – we only show integrations that return data */

          // Keep only summary data for Slack, retain an empty `details`
          // object so the value still satisfies the stricter type.
          const slimData =
            lookupResult.data === null
              ? null
              : {
                  ...lookupResult.data,
                  details: {} as Record<string, unknown>
                };

          const enriched: WithIntegrationInfo = {
            ...lookupResult,
            data: slimData,
            hasDetails,
            integrationId: id,
            integrationName: meta.name,
            integrationAcronym: meta.acronym
          };

          const { entity } = lookupResult;
          const key = `${(entity as Record<string, unknown>)['display-value'] ?? entity.value}|${entity.type}`;

          if (!resultsByEntity.has(key)) {
            resultsByEntity.set(key, []);
          }
          resultsByEntity.get(key)!.push(enriched);
        });

        // ────────────────────────────────────────────────────────────────────
        // Add explicit “no results” placeholders for entities that were
        // searched by this integration but returned zero matching results.
        // ────────────────────────────────────────────────────────────────────
        searchedEntities.forEach((entity) => {
          const found = lookupResults.some((r) => r.entity?.value === entity.value);
          if (!found) {
            const key = `${(entity as Record<string, unknown>)['display-value'] ?? entity.value}|${entity.type}`;

            const placeholder: WithIntegrationInfo = {
              entity,
              data: null,
              integrationId: id,
              integrationName: meta.name,
              integrationAcronym: meta.acronym
            };

            if (!resultsByEntity.has(key)) {
              resultsByEntity.set(key, []);
            }
            resultsByEntity.get(key)!.push(placeholder);
          }
        });
      } catch (err) {
        logger.error({ err, integrationId: id }, `Lookup failed for integration ${id}`);
        if (err instanceof ApiError) {
          await send({
            text: `:warning: ${meta.name || meta.acronym || id} lookup failed – ${err.message}`,
            blocks: buildErrorBlocks(meta.name || meta.acronym || id, err)
          });
        }
      } finally {
        completed += 1;
        await progressBar.update(completed);
        return;
      }
    })()
  );

  await Promise.all(lookupPromises);

  // ──────────────────────────────────────────────────────────────────────────
  // Drop any entity whose collected items all have `data: null` (i.e. none of
  // the integrations returned data). Then flatten the remaining results.
  // Note that at the moment there is no reliable way to know if a specific
  // entity was searched by an integration.  Currently, we pass all parsed entities
  // to all integrations and the server filters that list and only passes supported/enabled
  // entities to the integration.
  // PL-1053 is a ticket with a proposal to have the server return the list of
  // actual searched entities
  // ──────────────────────────────────────────────────────────────────────────
  for (const [key, items] of resultsByEntity) {
    if (items.every((item) => item.data === null)) {
      resultsByEntity.delete(key);
    }
  }
  const allResults: WithIntegrationInfo[] = Array.from(resultsByEntity.values()).flat();

  // Render all entities in a single block set and send once.
  const blocks = resultBlocksWithTitle(allResults);

  await send({
    text: 'Polarity results',
    blocks
  });

  /* no “missing integrations” summary anymore */
}

export default commandPolarity;
