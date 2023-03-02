import { App } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';

export const getSlackUserInfo = async (
  app: App<StringIndexed>,
  slackID: string
) => {
  const { user } = await app.client.users.info({
    token: process.env.SLACK_BOT_TOKEN,
    user: slackID,
    include_locale: true,
  });

  if (!user?.id) throw new Error('Slack user not found in workspace');

  return user as Required<Pick<typeof user, 'id'>> & typeof user;
};
