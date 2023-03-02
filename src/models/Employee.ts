import { Employee as EmployeeT, TimeTracking } from '@prisma/client';
import { prisma } from '../db';

export type Shift = {
  start: Date;
  end: Date;
};

export class Employee {
  private id?: number;
  private name?: string;
  private slackId?: string;
  private createdAt?: Date;
  private updatedAt?: Date;
  private admin?: boolean;
  private tracking: TimeTracking[] = [];

  /** @returns the employee's status (clocked in or out) */
  get status(): 'in' | 'out' {
    // if there is no tracking, the employee is out
    if (this.tracking.length === 0) return 'out';

    // if the last tracking is an 'in', the employee is in
    if (this.tracking[0].type === 'in') return 'in';

    // if the last tracking is an 'out', the employee is out
    return 'out';
  }

  /** @returns the employee's last clock */
  get lastClock(): TimeTracking | null {
    return this.tracking[0] || null;
  }

  /** @returns whether the employee is an admin */
  get isAdmin(): boolean {
    return this.admin || false;
  }

  /** Returns the employee's worked hours today */
  get hoursWorkedToday() {
    // Get the current date at midnight
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let workedHours = 0;
    let lastClockIn: TimeTracking | null = null;
    this.tracking
      .filter(
        (x) =>
          x.time >= today &&
          x.time < new Date(today.getTime() + 24 * 60 * 60 * 1000)
      )
      .reverse()
      .forEach((clock) => {
        if (clock.type === 'in' && !lastClockIn) {
          lastClockIn = clock;
        }
        if (clock.type === 'out' && lastClockIn) {
          workedHours += clock.time.getTime() - lastClockIn.time.getTime();
          lastClockIn = null;
        }
      });
    return workedHours / 1000 / 60 / 60;
  }

  /** Returns the employee's name */
  get userName() {
    return this.name || '';
  }

  public async init(employee: string | Partial<EmployeeT>) {
    // If the employee is a string, it's a slackId, use it to load the employee from the db
    if (typeof employee === 'string') {
      this.slackId = employee;
      await this.loadEmployee();
      return this;
    }

    // If no slackId or name is present, throw an error
    if (!employee.slackId || !employee.name)
      throw new Error('Employee must have a slackId and a name');

    // If the employee is an object, check if the id is present
    // If it is, it's an existing employee, but no need to load it from the db
    if (employee.id) {
      this.id = employee.id;
      this.name = employee.name;
      this.slackId = employee.slackId;
      this.createdAt = employee.createdAt;
      this.updatedAt = employee.updatedAt;
      this.admin = employee.admin;
      await this.loadTracking();
      return this;
    }

    // If the employee is an object and doesn't have an id, it's a new employee
    // Create it in the db and load it
    const newEmployee = await prisma.employee.create({
      data: {
        name: employee.name,
        slackId: employee.slackId,
        ...employee,
      },
    });

    this.id = newEmployee.id;
    this.name = newEmployee.name;
    this.slackId = newEmployee.slackId;
    this.createdAt = newEmployee.createdAt;
    this.updatedAt = newEmployee.updatedAt;
    this.admin = newEmployee.admin;
    await this.loadTracking();
    return this;
  }

  /** Loads the employee from the db using their slackId */
  private async loadEmployee() {
    const employee = await prisma.employee.findUnique({
      where: {
        slackId: this.slackId,
      },
    });

    if (!employee) throw new Error('Employee not found on the database');

    this.id = employee.id;
    this.name = employee.name;
    this.slackId = employee.slackId;
    this.createdAt = employee.createdAt;
    this.updatedAt = employee.updatedAt;
    this.admin = employee.admin;

    await this.loadTracking();
  }

  /** Loads the employee's tracking from the db */
  private async loadTracking() {
    const tracking = await prisma.timeTracking.findMany({
      where: {
        employeeId: this.id,
      },
      orderBy: {
        time: 'desc',
      },
    });

    this.tracking = tracking;
  }

  public async clock(type: 'in' | 'out') {
    if (!this.id) throw new Error('Something went wrong loading the employee');

    // check if the employee is already clocked in/out
    if (this.status === type) {
      const hoursSinceLastClock = this.lastClock
        ? (new Date().getTime() - this.lastClock.time.getTime()) /
          1000 /
          60 /
          60
        : null;

      const lastClockStr = hoursSinceLastClock
        ? hoursSinceLastClock < 1
          ? `(${(hoursSinceLastClock * 60).toFixed(0)}m ago)`
          : `(${hoursSinceLastClock.toFixed(1)}h ago)`
        : '';

      throw new Error(`You are already clocked ${type}! ${lastClockStr}`);
    }

    // create a new clock in/out
    const newClock = await prisma.timeTracking.create({
      data: {
        employeeId: this.id,
        type,
        time: new Date(),
      },
    });

    // add the new clock to the tracking
    this.tracking.unshift(newClock);
  }

  /**
   * Parses the tracking and return an array of shifts
   *
   * @returns an array of shifts
   */
  public async getShifts(from: Date, to: Date) {
    const shifts: Shift[] = [];
    let lastClockIn: TimeTracking | null = null;
    this.tracking
      .filter((x) => x.time >= from && x.time < to)
      .reverse()
      .forEach((clock) => {
        if (clock.type === 'in' && !lastClockIn) {
          lastClockIn = clock;
        }
        if (clock.type === 'out' && lastClockIn) {
          shifts.push({
            start: lastClockIn.time,
            end: clock.time,
          });
          lastClockIn = null;
        }
      });
    return shifts;
  }
}
