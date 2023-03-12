import { Task } from '@prisma/client';
import { getOortToken } from './connector';
import { prisma } from './db';

export const saveTaskToOort = async (task: Task): Promise<void> => {
  const token = await getOortToken();

  // get employee name from task
  const employee = await prisma.employee.findUnique({
    where: {
      id: task.employeeId,
    },
  });

  // get project name from task
  const project = await prisma.project.findUnique({
    where: {
      id: task.projectId,
    },
  });

  const data = {
    ticket: task.ticket,
    description: task.description,
    date: task.date,
    hours: task.hours,
    project: project?.name || '',
    employee: employee?.name || '',
  };

  fetch(process.env.OORT_GRAPHQL_URL || '', {
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: `{"operationName":"addRecord","variables":{"form":"${process.env.OORT_FORM_ID}","data":{"ticket":"${data.ticket}","description":"${data.description}","date":"${data.date}","hours":${data.hours},"project":"${data.project}","employee":"${data.employee}"}},"query":"mutation addRecord($form: ID!, $data: JSON!, $display: Boolean) {\\n  addRecord(form: $form, data: $data) {\\n    id\\n    createdAt\\n    modifiedAt\\n    createdBy {\\n      name\\n      __typename\\n    }\\n    data(display: $display)\\n    form {\\n      uniqueRecord {\\n        id\\n        modifiedAt\\n        createdBy {\\n          name\\n          __typename\\n        }\\n        data\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n}"}`,
    method: 'POST',
  }).catch((error) => {
    console.error('Error trying to save tracking to OORT:', error);
  });
};
