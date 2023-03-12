import { Project } from '@prisma/client';
import { App } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { prisma } from '../db';
import { Employee } from '../models/Employee';
import { saveTaskToOort } from '../oort';
import { getSlackUserInfo } from '../utils/getSlackUserInfo';
import { respondError, sendErrorMessage } from '../utils/respondError';

const validateAndParseTrackArgs = async (str: string) => {
  // arguments are optional, but if provided, should be in the following format:
  // <project code> <date (today/yesterday are valid)> <time spent (in hours)> <description / ticket:description >
  const res = {} as {
    project?: Project;
    ticketNumber?: string;
    date?: Date;
    timeSpent?: string;
    description?: string;
  };

  // replace all multiple spaces with a single space
  str = str.replace(/\s+/g, ' ');
  const args = str.split(' ');

  // if length is greater than 4, join all the arguments after the first 3 into the description
  if (args.length >= 4) {
    const ticketAndDesc = args.slice(3).join(' ');
    const [ticket, description] = ticketAndDesc.split(':');

    if (description) {
      res.ticketNumber = ticket.trim();
      res.description = description.trim();
    } else {
      res.description = ticketAndDesc;
    }
  }

  // if length is greater than 3, parse the time spent
  if (args.length >= 3) {
    const timeSpent = parseFloat(args[2]);
    if (!isNaN(timeSpent)) {
      // should be in the format 'HH:MM'
      // get the hours and minutes
      const hours = Math.floor(timeSpent);
      const minutes = Math.round((timeSpent - hours) * 60);

      // add padding to hours and minutes
      res.timeSpent = `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
    }
  }

  // if length is greater than 2, parse the date
  if (args.length >= 2) {
    if (args[1].toLocaleLowerCase() === 'today') res.date = new Date();
    else if (args[1].toLocaleLowerCase() === 'yesterday')
      res.date = new Date(new Date().setDate(new Date().getDate() - 1));
    else {
      const date = new Date(args[1]);
      if (!isNaN(date.getTime())) {
        res.date = date;
      }
    }
  }

  // if length is greater than 1, parse the project code
  if (args.length >= 1) {
    const project = await prisma.project.findUnique({
      where: {
        code: args[0].toLocaleUpperCase(),
      },
    });

    if (project) {
      res.project = project;
    }
  }

  return res;
};

export default {
  init: (app: App<StringIndexed>) => {
    app.command('/track', async ({ ack, payload, respond }) => {
      await ack();

      if (payload.text === 'help') {
        await respond({
          text: ">/track [project code] [date] [time spent] [description]\n\n*project code*: the project code (e.g. 'WHO')\n*date*: the date the ticket was done on (e.g. 'today', 'yesterday', '2021-01-01', '01/20/2021')\n*time spent*: the time spent on the ticket (e.g. '1.5', '2', '12')\n*description*: the description of the ticket, can also include ticket (e.g. 'Fixed bug', 'ABC-123:Fixed bug')\n\n>Example: /track WHO today 1.5 AB#12345:Fixed bug on map widget",
        });
        return;
      }

      try {
        const projects = await prisma.project.findMany();

        const { project, ticketNumber, date, timeSpent, description } =
          await validateAndParseTrackArgs(payload.text);

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
              // Date picker
              {
                type: 'input',
                block_id: 'date',
                label: {
                  type: 'plain_text',
                  text: 'Ticket done on',
                },
                element: {
                  type: 'datepicker',
                  action_id: 'date',
                  initial_date: (date || new Date())
                    .toISOString()
                    .split('T')[0],
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select date',
                    emoji: true,
                  },
                },
              },
              // Time spent
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
                  initial_time: timeSpent,
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select time',
                    emoji: true,
                  },
                },
              },
              // Ticket number
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
                  initial_value: ticketNumber,
                },
              },
              // Description
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
                  initial_value: description,
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
        const createdTask = await prisma.task.create({
          data: {
            description,
            hours,
            ticket: ticket || null,
            projectId: parseInt(projectId),
            employeeId: employee.userId,
          },
        });

        saveTaskToOort(createdTask);

        await app.client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: body.user.id,
          text: `Tracking created for project *${project.name}*\n\n*Project:* ${
            project.code
          }\n*Ticket:* ${
            ticket || 'N/A'
          }\n*Description:* ${description}\n*Time spent:* ${time}\n*Date:* ${
            view.state.values.date.date.selected_date
          }`,
        });
      } catch (error) {
        await sendErrorMessage(app, body.user.id, error);
      }
    });
  },
};
