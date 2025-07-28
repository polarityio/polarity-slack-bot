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
  const userId = (body as SlackBodyWithUser).user?.id;
  if (!userId) {
    logger.error('Unexpected body structure in refresh_integrations action');
    await ack();
    return;
  }

  /* 1️⃣  Disable the button and show a “refreshing” notice for this user */
  await ack({
    response_action: 'update',
    view: {
      type: 'home',
      blocks: appHomeBlocks({
        isAdmin: true,
        refreshDisabled: true,
        showRefreshingNotice: true
      })
    }
  });

  /* 2️⃣  Perform the refresh */
  await integrationService.load();

  /* 3️⃣  Restore the normal Home view (button enabled, notice gone) */
  await client.views.publish({
    user_id: userId,
    view: {
      type: 'home',
      blocks: appHomeBlocks({ isAdmin: true })
    }
  });
}


export default actionRefreshIntegrations;
