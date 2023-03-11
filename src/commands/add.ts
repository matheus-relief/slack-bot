import { App, BlockUsersSelectAction } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { Employee } from '../models/Employee';
import { getSlackUserInfo } from '../utils/getSlackUserInfo';
import { respondError, sendErrorMessage } from '../utils/respondError';
import { prisma } from '../db';

const cache = new Map<string, Awaited<ReturnType<typeof getSlackUserInfo>>>();

export default {
  init: (app: App<StringIndexed>) => {
    app.command('/add', async ({ ack, payload, respond }) => {
      await ack();

      try {
        const user = await getSlackUserInfo(app, payload.user_id);
        const employee = await new Employee().init(user.id);

        if (!employee.isAdmin)
          throw new Error(
            "Sorry, you don't have permission to use this command"
          );

        // Reset exportMap for this user
        cache.delete(user.id);

        const param = payload.text.split(' ')[0];
        const type =
          param === 'project' ? 'project' : param === 'user' ? 'user' : null;

        switch (type) {
          case 'project':
            await app.client.views.open({
              token: process.env.SLACK_BOT_TOKEN,
              trigger_id: payload.trigger_id,
              view: {
                type: 'modal',
                callback_id: 'new_project_modal',
                title: {
                  type: 'plain_text',
                  text: 'Project information',
                },
                submit: {
                  type: 'plain_text',
                  text: 'Create',
                },
                close: {
                  type: 'plain_text',
                  text: 'Cancel',
                },
                blocks: [
                  {
                    type: 'input',
                    block_id: 'name',
                    label: {
                      type: 'plain_text',
                      text: 'Name',
                    },
                    element: {
                      type: 'plain_text_input',
                      action_id: 'name',
                    },
                  },
                  {
                    type: 'input',
                    block_id: 'code',
                    label: {
                      type: 'plain_text',
                      text: 'Code',
                    },
                    element: {
                      type: 'plain_text_input',
                      action_id: 'code',
                    },
                  },
                ],
              },
            });
            return;
          case 'user':
            // Send message with slack user input
            await respond({
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'Please select the user to add:',
                  },
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'users_select',
                      action_id: 'add_user_select',
                      placeholder: {
                        type: 'plain_text',
                        text: 'Select a user',
                      },
                    },
                  ],
                },
              ],
            });
            return;

          default:
            throw new Error(
              'Invalid command.\nUsage: `/add project` or `/add user`'
            );
        }
      } catch (error) {
        await respondError(respond, error);
      }
    });

    app.view('new_project_modal', async ({ ack, body, view }) => {
      await ack();

      try {
        // Extract the text input values from the view
        const name = view.state.values.name.name.value;
        const code = view.state.values.code.code.value?.toUpperCase();

        if (!code || !name)
          throw new Error(
            'Project code and name are required to create a project'
          );

        // Check if there is already a project with this code
        const project = await prisma.project.findFirst({
          where: {
            code,
          },
        });

        if (project)
          throw new Error(
            `There is a conflicting project.\nFound the following project with the same code: *${project.name}* (${project.code})`
          );

        // Create the project
        await prisma.project.create({
          data: {
            name,
            code,
          },
        });

        // Use the text input values for further processing or respond to the user
        await app.client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: body.user.id,
          text: `🥳🐵 Project ${name} (${code}) create successfully!`,
        });
      } catch (e) {
        if (e instanceof Error) await sendErrorMessage(app, body.user.id, e);
      }
    });

    app.action('add_user_select', async ({ ack, body: bdy, respond }) => {
      const body = bdy as BlockUsersSelectAction;
      await ack();

      try {
        const newUserSlackId = body.actions[0].selected_user;
        const user = await getSlackUserInfo(app, newUserSlackId);

        // saves the selected user in the cache
        cache.set(body.user.id, user);

        // Open modal with text input for user name and checkbox for admin
        await app.client.views.open({
          token: process.env.SLACK_BOT_TOKEN,
          trigger_id: body.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'new_user_modal',
            title: {
              type: 'plain_text',
              text: 'Confirm user information',
            },
            submit: {
              type: 'plain_text',
              text: 'Create',
            },
            close: {
              type: 'plain_text',
              text: 'Cancel',
            },
            blocks: [
              {
                type: 'input',
                block_id: 'name',
                label: {
                  type: 'plain_text',
                  text: 'Name',
                },
                element: {
                  type: 'plain_text_input',
                  initial_value: user.real_name,
                  action_id: 'name',
                },
              },
              // Checkbox input for admin
              {
                type: 'input',
                block_id: 'admin',
                optional: true,
                label: {
                  type: 'plain_text',
                  text: 'Admin',
                },
                element: {
                  type: 'checkboxes',
                  action_id: 'admin',
                  options: [
                    {
                      text: {
                        type: 'plain_text',
                        text: 'Admin',
                      },
                      value: 'admin',
                    },
                  ],
                },
              },
            ],
          },
        });
        return;
      } catch (error) {
        await respondError(respond, error);
      }
    });

    app.view('new_user_modal', async ({ ack, body, view, respond }) => {
      await ack();

      try {
        // Extract the text input values from the view
        const name = view.state.values.name.name.value;
        const admin =
          (view.state.values.admin.admin.selected_options?.length || 0) > 0;

        if (!name) throw new Error('User name is required to create a user');

        const user = cache.get(body.user.id);
        if (!user)
          throw new Error(
            'User not found in cache\nTry again with the command `/add user`'
          );

        await new Employee().init({
          name,
          slackId: user.id,
          admin,
        });

        // If no error is thrown, the user is created
        await app.client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: body.user.id,
          text: `🥳🐵 User ${name} created successfully!`,
        });
      } catch (e) {
        await sendErrorMessage(app, body.user.id, e);
      }
    });
  },
};
