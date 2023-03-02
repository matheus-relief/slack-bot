import { RespondFn } from '@slack/bolt';

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
