import type { KnownBlock } from '@slack/types';
import type { SendFn } from '../utils/slack-messenger';

/**
 * Optional configuration values that alter appearance or behaviour.
 */
export interface ProgressBarOptions {
  /** Number of “cells” in the rendered bar (default: 20). */
  width?: number;
}

/**
 * Required parameters for creating a ProgressBar.
 */
export interface ProgressBarConfig {
  /** Channel-bound send helper from {@link createMessenger}. */
  send: SendFn;
  /** Descriptive label shown above the bar. */
  label: string;
  /** Total units of work to be completed. Must be > 0. */
  total: number;
  /** Optional tweaks. */
  options?: ProgressBarOptions;
}

/**
 * In-place updating progress bar rendered as a Slack message.
 *
 * The first call to {@link update} posts the bar; subsequent calls edit that
 * same message. Call {@link destroy} to erase it.  After destruction the
 * instance becomes unusable and further calls will throw.
 */
export class ProgressBar {
  #send: SendFn;
  #label: string;
  #total: number;
  #width: number;
  /** Promise resolving to the timestamp (`ts`) of the Slack message. */
  #tsPromise: Promise<string> | undefined;
  #destroyed = false;
  #lastDone = 0;
  /** Serialisation chain that keeps Slack updates in order */
  #queuePromise: Promise<void> = Promise.resolve();

  constructor({ send, label, total, options }: ProgressBarConfig) {
    if (total <= 0) {
      throw new Error('`total` must be greater than 0');
    }

    this.#send = send;
    this.#label = label;
    this.#total = total;
    this.#width = options?.width ?? 20;
  }

  /**
   * Render or update the progress bar.
   *
   * @param done – Units completed so far (0 ≤ done ≤ total)
   */
  async update(done: number): Promise<void> {
    this.#ensureLive();

    if (done < 0 || done > this.#total) {
      throw new Error('`done` must be between 0 and total inclusive');
    }

    // Prevent race-conditions: ignore updates that would move the bar backwards
    // or repeat the same value when a newer (larger) update is already sent.
    if (done <= this.#lastDone) {
      return;
    }
    this.#lastDone = done;

    await this.#enqueue(async () => {
      // First invocation → post initial message
      if (!this.#tsPromise) {
        this.#tsPromise = this.#send({
          text: `${this.#label} ${done}/${this.#total}`,
          blocks: ProgressBar.#buildBlocks(this.#label, done, this.#total, this.#width)
        });
        return;
      }

      // Subsequent invocations → update existing message
      const ts = await this.#tsPromise;
      await this.#send({
        text: `${this.#label} ${done}/${this.#total}`,
        blocks: ProgressBar.#buildBlocks(this.#label, done, this.#total, this.#width),
        messageTimestamp: ts
      });
    });
  }

  /**
   * Change the label and immediately repaint the bar keeping current progress.
   *
   * @param newLabel – New descriptive label
   */
  async setLabel(newLabel: string): Promise<void> {
    this.#ensureLive();
    this.#label = newLabel;
    await this.update(this.#lastDone);
  }

  /**
   * Remove the progress bar message from Slack. After calling this the instance
   * becomes invalid and further calls will throw.
   */
  async destroy(): Promise<void> {
    this.#ensureLive();
    this.#destroyed = true;

    // If never rendered, there is nothing to erase.
    if (!this.#tsPromise) {
      return;
    }

    const ts = await this.#tsPromise;
    await this.#send({ text: ' ', blocks: [], messageTimestamp: ts });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────
  #ensureLive(): void {
    if (this.#destroyed) {
      throw new Error('ProgressBar instance has been destroyed – create a new one.');
    }
  }

  /**
   * Queue `task` so that only one network call is in flight at a time and the
   * calls execute strictly in the order they were issued.
   */
  async #enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.#queuePromise.then(task);
    // Preserve the chain even if a task rejects
    this.#queuePromise = next.catch(() => {});
    return next;
  }

  static #buildBar(done: number, total: number, width: number): string {
    const filled = Math.round((done / total) * width);
    return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
  }

  static #buildBlocks(label: string, done: number, total: number, width: number): KnownBlock[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${label}*\n${ProgressBar.#buildBar(done, total, width)}  ${done}/${total}`
        }
      }
    ];
  }
}
