import {
  App,
  BlockAction,
  DatepickerAction,
  UsersSelectAction,
} from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { Employee, Shift } from '../models/Employee';
import { getShiftsWorkbook } from '../utils/getShiftsWorkbook';
import { getSlackUserInfo } from '../utils/getSlackUserInfo';
import { respondError } from '../utils/respondError';
import { getDateWithOffset } from '../utils/setDateOffset';
import { prisma } from '../db';

// In memory map for storing export information
// Key is the user SlackID, value is an object with the start and end dates and selected user, if any
const exportMap = new Map<string, { start?: Date; end?: Date }>();

export default {
  init: (app: App<StringIndexed>) => {
    app.command('/export', async ({ ack, payload, respond }) => {
      await ack();

      try {
        const user = await getSlackUserInfo(app, payload.user_id);
        const employee = await new Employee().init(user.id);
        console.log(user);

        if (!employee.isAdmin)
          throw new Error(
            "Sorry, you don't have permission to use this command"
          );

        // Reset exportMap for this user
        exportMap.delete(user.id);

        // Send message to user asking to input start and end dates
        await respond({
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '📅 Please select the start date for the export:',
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'datepicker',
                  action_id: 'start_export_date',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select a start date',
                  },
                },
                {
                  type: 'datepicker',
                  action_id: 'end_export_date',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select an end date',
                  },
                },
              ],
            },
          ],
        });
        return;
      } catch (error) {
        await respondError(respond, error);
      }
    });

    // for each time picker, create a listener
    (['start', 'end'] as const).forEach((type) => {
      app.action(`${type}_export_date`, async ({ ack, body: bdy, respond }) => {
        // casting body to BlockAction type
        const body = bdy as BlockAction;
        await ack();

        try {
          if (!('actions' in body))
            throw new Error(`Error specifying ${type} date`);

          const datePickAction = body.actions[0] as DatepickerAction;

          // get user tz offset from slack
          const user = await getSlackUserInfo(app, body.user.id);

          const date = getDateWithOffset(
            datePickAction.selected_date,
            user.tz_offset || 0,
            type === 'end'
          );

          // gets the user SlackID
          const userSlackId = body.user.id;

          // if the user SlackID is not in the map, add it
          if (!exportMap.has(userSlackId)) {
            exportMap.set(userSlackId, {
              [type]: date || undefined,
            });
          } else {
            // if the user SlackID is in the map, update the date
            const exportInfo = exportMap.get(userSlackId);
            if (exportInfo) exportInfo[type] = date || undefined;
          }

          // If both dates are set, ask for user to select
          const exportInfo = exportMap.get(userSlackId);
          if (exportInfo && exportInfo.start && exportInfo.end) {
            await respond({
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'Do you want to export the data for a specific user?',
                  },
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'users_select',
                      placeholder: {
                        type: 'plain_text',
                        text: 'Select a user',
                        emoji: true,
                      },
                      action_id: 'user-selection-export',
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: 'Export all',
                        emoji: true,
                      },
                      action_id: 'export-all',
                    },
                  ],
                },
              ],
            });
          }

          return;
        } catch (error) {
          await respondError(respond, error);
        }
      });
    });

    ['export-all', 'user-selection-export'].forEach((actionId) => {
      app.action(actionId, async ({ ack, body: bdy, respond }) => {
        // casting body to BlockAction type
        const body = bdy as BlockAction;
        await ack();

        try {
          if (!('actions' in body))
            throw new Error('Error specifying user to export');

          // gets the user SlackID
          const userSlackId = body.user.id;

          const user = await getSlackUserInfo(app, body.user.id);

          const exportInfo = exportMap.get(userSlackId);
          if (!exportInfo || !exportInfo.start || !exportInfo.end)
            throw new Error(
              'One or both dates are not set.\nType `/export` to start again.'
            );

          let shifts = new Map<string, Shift[]>();

          const startDate = exportInfo.start;
          const endDate = exportInfo.end;

          // If the action is user-selection-export, get the selected user
          if (actionId === 'user-selection-export') {
            const userSelectAction = body.actions[0] as UsersSelectAction;
            const employee = await new Employee().init(
              userSelectAction.selected_user
            );

            shifts.set(
              employee.userName,
              await employee.getShifts(startDate, endDate)
            );
          } else {
            // get all employees
            const allEmployees = await prisma.employee.findMany({});
            for (const e of allEmployees) {
              const employee = await new Employee().init(e);
              shifts.set(
                employee.userName,
                await employee.getShifts(startDate, endDate)
              );
            }
          }
          const workbook = await getShiftsWorkbook(
            Object.fromEntries(shifts),
            user.locale
          );
          // to stream the file to the user
          const buffer: any = await workbook.xlsx.writeBuffer();

          // return the file to the user
          await app.client.files.uploadV2({
            token: process.env.SLACK_BOT_TOKEN,
            channel_id: body.channel?.id,
            file: buffer,
            filename: `shifts.xlsx`,
            title: `Shifts export.xlsx`,
            initial_comment: `🐵 Here you go!`,
          });

          return;
        } catch (error) {
          await respondError(respond, error);
        }
      });
    });
  },
};
