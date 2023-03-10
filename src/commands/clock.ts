import { App } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { Employee } from '../models/Employee';
import { getSlackUserInfo } from '../utils/getSlackUserInfo';
import { respondError } from '../utils/respondError';

export default {
  init: (app: App<StringIndexed>) => {
    app.command('/clock', async ({ ack, payload, respond }) => {
      await ack();

      try {
        const user = await getSlackUserInfo(app, payload.user_id);
        const employee = await new Employee().init(user.id);

        // gets type command (in, out)
        const type = ['in', 'back'].includes(payload.text.toLocaleLowerCase())
          ? 'in'
          : ['out', 'leave', 'break', 'lunch'].includes(
              payload.text.toLocaleLowerCase()
            )
          ? 'out'
          : null;

        // type not found
        if (!type) {
          await respond({
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: "Sorry, I couldn't understand your command... Use `/clock in` or `/clock out`",
                },
              },
            ],
          });
          return;
        }

        // clock in/out
        await employee.clock(type);

        const hoursWorkedStr =
          employee.hoursWorkedToday < 1
            ? Math.round(employee.hoursWorkedToday * 60) + 'm'
            : employee.hoursWorkedToday.toFixed(1) + 'h';

        // if no errors, send success message
        await respond({
          text: `${
            employee.hoursWorkedToday === 0 ? 'Hi! Good to see you! 👋🐵 ' : ''
          }Clocked ${type} successfully!${
            employee.hoursWorkedToday > 0
              ? `\nYou've worked ${hoursWorkedStr} today so far.`
              : ''
          }`,
        });
        return;
      } catch (error) {
        await respondError(respond, error);
      }
    });
  },
};
