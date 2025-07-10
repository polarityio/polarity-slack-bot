import type {
  SlackEventMiddlewareArgs,
  AllMiddlewareArgs
} from '@slack/bolt';
import { appHomeBlocks } from '../blocks/app-home-block';

type AppHomeOpenedArgs =
    SlackEventMiddlewareArgs<'app_home_opened'> & AllMiddlewareArgs;

async function eventAppHomeOpened({ event, client } : AppHomeOpenedArgs) {
  // Extra admins from env-var (comma-separated IDs)
  const extraAdmins =
    process.env.POLARITY_SLACK_BOT_ADMIN_MEMBER_IDS?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? [];

  // Determine if the user is a workspace admin/owner to show config widgets
  const userInfo = await client.users.info({ user: event.user });
  const slackAdmin =
    !!userInfo.user &&
    (userInfo.user.is_admin ||
      userInfo.user.is_owner ||
      userInfo.user.is_primary_owner);

  const isAdmin = slackAdmin || extraAdmins.includes(event.user);

  const blocks = appHomeBlocks({ isAdmin });

  await client.views.publish({
    user_id: event.user,
    view: { type: 'home', blocks }
  });
}


export default eventAppHomeOpened;
