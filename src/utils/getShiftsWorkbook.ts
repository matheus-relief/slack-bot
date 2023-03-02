import { Workbook } from 'exceljs';
import { Shift } from '../models/Employee';

const DEFAULT_LOCALE = 'es-ES';

export const getShiftsWorkbook = async (
  shifts: { [key: string]: Shift[] },
  locale = DEFAULT_LOCALE
) => {
  // create workbook
  const workbook = new Workbook();

  // for each employee, create a worksheet
  for (const employeeName in shifts) {
    const userShifts = shifts[employeeName];
    // create worksheet
    const worksheet = workbook.addWorksheet(
      `${employeeName}${
        employeeName[employeeName.length - 1] === 's' ? "'" : "'s"
      } shifts`
    );

    // add header row
    const header = worksheet.addRow(['Date', 'From', 'To']);
    // add style to header row (only columns 1-3)
    header.eachCell((cell, number) => {
      if (number <= 3) {
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
    userShifts.forEach((shift) => {
      const date = shift.start.toLocaleDateString(locale);
      const from = shift.start.toLocaleTimeString(locale);
      const to = shift.end.toLocaleTimeString(locale);
      worksheet.addRow([date, from, to]);
    });

    // adjust column width
    worksheet.columns.forEach((column) => {
      column.width = 20;
    });
  }

  // return workbook
  return workbook;
};
