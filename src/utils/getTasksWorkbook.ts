import { Task } from '@prisma/client';
import { Workbook } from 'exceljs';
import { prisma } from '../db';

export const getTasksWorkbook = async (tasks: { [key: string]: Task[] }) => {
  // create workbook
  const workbook = new Workbook();

  // gather all the projects
  const projectIds = new Set<number>();
  const users = Object.keys(tasks);
  users.forEach((user) => {
    tasks[user].forEach((task) => {
      projectIds.add(task.projectId);
    });
  });

  // get the project names
  const projects = await prisma.project.findMany({
    where: {
      id: {
        in: [...projectIds],
      },
    },
  });

  // for each employee, create a worksheet
  for (const employeeName in tasks) {
    const userTasks = tasks[employeeName];
    // create worksheet
    const worksheet = workbook.addWorksheet(
      `${employeeName}${
        employeeName[employeeName.length - 1] === 's' ? "'" : "'s"
      } tracked tasks`
    );

    // add header row
    const header = worksheet.addRow([
      'Project',
      'Ticket',
      'Time spent',
      'Description',
    ]);
    // add style to header row (only columns 1-4)
    header.eachCell((cell, number) => {
      if (number <= 4) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '#E33F20' },
          bgColor: { argb: '#E33F20' },
        };
        cell.font = { bold: true, color: { argb: '#FFFFFF' } };
      }
    });

    // add rows
    userTasks.forEach((task) => {
      const projectName = projects.find((p) => p.id === task.projectId)?.name;
      const hoursStr = `${Math.floor(task.hours)}h${
        task.hours - Math.floor(task.hours) * 60
      }m}`;

      worksheet.addRow([
        projectName || 'Unknown project',
        task.ticket,
        hoursStr,
        task.description,
      ]);
    });

    // adjust column width
    worksheet.columns.forEach((column) => {
      column.width = 20;
    });
  }

  // return workbook
  return workbook;
};
