import { enforceNodeVersion } from './check-node-version';
enforceNodeVersion();

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { App } from '@slack/bolt';
import { logger } from './logger';
import { integrationService } from './services/integration-service';
import commandPolarity from './routes/command-polarity';
import eventAppHomeOpened from './routes/event-app-home-opened';
import actionRefreshIntegrations from './routes/action-refresh-integrations';
import actionShowDetails from './routes/action-show-details';
import actionShowErrorDetails from './routes/action-show-error-details';

const app = new App({
  token: process.env.POLARITY_SLACK_BOT_TOKEN,
  signingSecret: process.env.POLARITY_SLACK_BOT_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.POLARITY_SLACK_BOT_APP_TOKEN
});

app.command('/polarity', commandPolarity);
app.event('app_home_opened', eventAppHomeOpened);
app.action('refresh_integrations', actionRefreshIntegrations);
app.action('show_details', actionShowDetails);
app.action('show_error_details', actionShowErrorDetails);

(async () => {
  try {
    await app.start();
    await integrationService.load();
    logger.info('⚡️ Polarity Slack Bot is running!');
  } catch (err) {
    logger.error({err}, 'Polarity Slack Bot Startup failed');
    process.exit(1);
  }
})();
