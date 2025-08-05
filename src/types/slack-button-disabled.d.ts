import '@slack/types';

/**
 * Slack added a “disabled” property to button elements,
 * but the current @slack/types definitions don’t include it.
 * Augment the type here so TypeScript accepts the field.
 */
declare module '@slack/types' {
  interface Button {
    /** Whether the button is greyed-out / inactive. */
    disabled?: boolean;
  }
}
