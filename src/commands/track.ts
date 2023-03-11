import { Project } from '@prisma/client';
import { App } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { prisma } from '../db';
import { Employee } from '../models/Employee';
import { getSlackUserInfo } from '../utils/getSlackUserInfo';
import { respondError, sendErrorMessage } from '../utils/respondError';

export default {
  init: (app: App<StringIndexed>) => {
    app.command('/track', async ({ ack, payload, respond }) => {
      await ack();

      try {
        // get projects
        const projects = await prisma.project.findMany();

        // check if user provided a project code
        const projectCode = payload.text.split(' ')[0];
        const project = projects.find(
          (p) => p.code.toLocaleLowerCase() === projectCode.toLocaleLowerCase()
        );

        await app.client.views.open({
          token: process.env.SLACK_BOT_TOKEN,
          trigger_id: payload.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'new_tracking_modal',
            title: {
              type: 'plain_text',
              text: 'New tracking',
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
                optional: true,
                block_id: 'ticket',
                label: {
                  type: 'plain_text',
                  text: 'Ticket number',
                },
                element: {
                  type: 'plain_text_input',
                  action_id: 'ticket',
                },
              },
              {
                type: 'input',
                block_id: 'description',
                label: {
                  type: 'plain_text',
                  text: 'Short description',
                },
                element: {
                  type: 'plain_text_input',
                  action_id: 'description',
                },
              },
              {
                type: 'input',
                block_id: 'time',
                label: {
                  type: 'plain_text',
                  text: 'Time spent',
                },
                element: {
                  type: 'timepicker',
                  action_id: 'time',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select time',
                    emoji: true,
                  },
                },
              },
              // Select for projects
              {
                type: 'input',
                block_id: 'project',
                label: {
                  type: 'plain_text',
                  text: 'Project',
                },
                element: {
                  type: 'static_select',
                  action_id: 'project',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select project',
                    emoji: true,
                  },
                  initial_option: project
                    ? {
                        text: {
                          type: 'plain_text',
                          text: `(${project.code}) ${project.name}`,
                          emoji: true,
                        },
                        value: `${project.id}`,
                      }
                    : undefined,
                  options: projects.map((project) => ({
                    text: {
                      type: 'plain_text',
                      text: `(${project.code}) ${project.name}`,
                      emoji: true,
                    },
                    value: `${project.id}`,
                  })),
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

    app.view('new_tracking_modal', async ({ ack, body, view }) => {
      await ack();

      try {
        const user = await getSlackUserInfo(app, body.user.id);
        const employee = await new Employee().init(user.id);

        const ticket = view.state.values.ticket.ticket.value;
        const description = view.state.values.description.description.value;
        const time = view.state.values.time.time.selected_time;
        const projectId =
          view.state.values.project.project.selected_option?.value;

        const hours = time
          ? parseInt(time.split(':')[0]) + parseInt(time.split(':')[1]) / 60
          : 0;

        if (!projectId)
          throw new Error(
            'Project not found. Try again and select a project from the list\n.Usage: `/track [project code]`'
          );

        const project = await prisma.project.findUnique({
          where: { id: parseInt(projectId) },
        });

        if (!project)
          throw new Error(
            'Project not found. Try again and select a project from the list\n.Usage: `/track [project code]`'
          );

        if (!description) throw new Error('Description not provided');
        console.log('employee.userId', employee.userId);
        await prisma.task.create({
          data: {
            description,
            hours,
            ticket: ticket || null,
            projectId: parseInt(projectId),
            employeeId: employee.userId,
          },
        });

        await app.client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: body.user.id,
          text: `Tracking created for project *${project.name}*`,
        });
      } catch (error) {
        await sendErrorMessage(app, body.user.id, error);
      }
    });
  },
};
