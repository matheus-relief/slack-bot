import { App, RespondFn } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';

export const respondError = async (respond: RespondFn, error: unknown) => {
  if (error instanceof Error) {
    console.error(error);
    const msgStr = error.message
      .split('\n')
      .map((msg) => `>${msg}`)
      .join('\n');

    await respond({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🙈 Something went wrong...\n${msgStr}`,
          },
        },
      ],
    });
    return;
  }
};

export const sendErrorMessage = async (
  app: App<StringIndexed>,
  channel: string,
  error: unknown
) => {
  if (error instanceof Error) {
    console.error(error);
    const msgStr = error.message
      .split('\n')
      .map((msg) => `>${msg}`)
      .join('\n');

    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel,
      text: `🙈 Something went wrong...\n${msgStr}`,
    });
    return;
  }
};
