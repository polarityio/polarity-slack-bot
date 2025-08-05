import { AllMiddlewareArgs, SlackActionMiddlewareArgs } from '@slack/bolt';

/**
 * Opens a modal showing the raw metadata captured in {@link ApiError}.
 */
async function actionShowErrorDetails({ ack, body, action, client }: SlackActionMiddlewareArgs & AllMiddlewareArgs) {
  await ack();

  const value =
    typeof (action as { value?: unknown }).value === 'string' ? (action as { value: string }).value : undefined;

  await client.views.open({
    trigger_id: (body as { trigger_id: string }).trigger_id,
    view: {
      type: 'modal',
      title: { type: 'plain_text', text: 'Error Details' },
      close: { type: 'plain_text', text: 'Close' },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '```' + value + '```'
          }
        }
      ]
    }
  });
}

export default actionShowErrorDetails;
