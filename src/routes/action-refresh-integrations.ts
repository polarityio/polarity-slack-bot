import { integrationService } from '../services/integration-service';
import { appHomeBlocks } from '../blocks/app-home-block';
import type { AllMiddlewareArgs, BlockAction, SlackActionMiddlewareArgs } from '@slack/bolt';
import type { SlackBodyWithUser } from '../types';
import { logger } from '../logger';

async function actionRefreshIntegrations({
  ack,
  body,
  client
}: SlackActionMiddlewareArgs<BlockAction> & AllMiddlewareArgs) {
  await ack();

  // Re-load running integrations
  await integrationService.load();

  // Rebuild Home tab blocks (admin view)
  const blocks = appHomeBlocks({ isAdmin: true });

  const userId = (body as SlackBodyWithUser).user?.id;
  if (userId) {
    await client.views.publish({
      user_id: userId,
      view: { type: 'home', blocks }
    });
  } else {
    logger.error('Unexpected body structure in refresh_integrations action');
  }
}


export default actionRefreshIntegrations;
