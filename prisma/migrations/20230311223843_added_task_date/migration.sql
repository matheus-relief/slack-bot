/*
  Warnings:

  - Added the required column `date` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "ticket" TEXT,
    "date" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "employeeId" INTEGER NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("createdAt", "description", "employeeId", "hours", "id", "projectId", "ticket", "updatedAt") SELECT "createdAt", "description", "employeeId", "hours", "id", "projectId", "ticket", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
