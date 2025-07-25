import type { KnownBlock } from '@slack/types';
import type { WebClient } from '@slack/web-api';
import { logger } from '../logger';

/**
 * Arguments accepted by the `send` helper returned from {@link createMessenger}.
 */
export interface SendArgs {
  /** Fallback text (required by Slack, shown in notifications and legacy clients). */
  text: string;
  /** Optional Block Kit content. */
  blocks?: KnownBlock[];
  /**
   * When provided, the helper will update the existing message instead of
   * sending a new one.
   */
  messageTimestamp?: string;
  /**
   * When set to `"ephemeral"` the message is only visible to a specific user.
   * Defaults to `"in_channel"` (ordinary public message).
   */
  response_type?: 'ephemeral' | 'in_channel';
  /**
   * Slack user ID that will receive an ephemeral message.
   * Required when `response_type === "ephemeral"`.
   */
  userId?: string;
}

export type SendFn = (args: SendArgs) => Promise<string>;

/**
 * Factory that returns a `send` function bound to a specific channel.
 * The returned function will post a fresh message, or update an existing one
 * when `messageTimestamp` is supplied.
 */
/**
 * Factory that returns a channel-bound `send` helper.
 *
 * @example Regular message
 * ```ts
 * const send = createMessenger(client, channelId);
 * const ts = await send({ text: 'Hello world' });
 * ```
 *
 * @example Updating that message later
 * ```ts
 * await send({ text: 'Updated', messageTimestamp: ts });
 * ```
 *
 * @example Ephemeral reply to the command invoker
 * ```ts
 * await send({
 *   text: 'Only you can see this',
 *   response_type: 'ephemeral',
 *   userId: command.user_id   // user to show the message to
 * });
 * ```
 */
export function createMessenger(client: WebClient, channelId: string): SendFn {
  return async function send({
    text,
    blocks,
    messageTimestamp,
    response_type = 'in_channel',
    userId
  }: SendArgs): Promise<string> {
    // ──────────────────────────────────────────────────────────────────────────
    // Update an existing message
    // ──────────────────────────────────────────────────────────────────────────
    if (messageTimestamp) {
      const res = await client.chat.update({
        channel: channelId,
        ts: messageTimestamp,
        text,
        blocks
      });
      return String(res.ts);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Ephemeral message
    // ──────────────────────────────────────────────────────────────────────────
    if (response_type === 'ephemeral') {
      if (!userId) {
        throw new Error('`userId` is required when sending an ephemeral message');
      }
      const res = await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text,
        blocks
      });
      // postEphemeral returns `message_ts`
      return String(res.message_ts);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Public message (default)
    // ──────────────────────────────────────────────────────────────────────────
    try {
      const res = await client.chat.postMessage({ channel: channelId, text, blocks });
      return String(res.ts);
    } catch (err) {
      // The bot is not in the channel yet → try to join and retry once.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const slackErr = err as { code?: string; data?: { error?: string } };
      if (
        slackErr?.code === 'slack_webapi_platform_error' &&
        slackErr.data?.error === 'not_in_channel'
      ) {
        try {
          // conversations.join covers public & private channels the bot can access
          // @ts-expect-error – method typing is incomplete in @slack/web-api
          await client.conversations.join({ channel: channelId });
        } catch (joinErr) {
          logger.warn(
            { channelId, err: joinErr },
            'Failed to join channel; will still attempt to send the message'
          );
        }
        // Retry posting the message; let any subsequent error bubble up.
        const res = await client.chat.postMessage({ channel: channelId, text, blocks });
        return String(res.ts);
      }
      throw err;
    }
  };
}
