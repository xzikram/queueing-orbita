-- AlterTable
ALTER TABLE "visits" ADD COLUMN "doctor_ticket_no" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_counters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "can_handle_admission" BOOLEAN NOT NULL DEFAULT true,
    "can_handle_cashier" BOOLEAN NOT NULL DEFAULT true,
    "assigned_role" TEXT,
    "assigned_user_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "counters_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_counters" ("can_handle_admission", "can_handle_cashier", "code", "created_at", "id", "is_active", "name", "updated_at") SELECT "can_handle_admission", "can_handle_cashier", "code", "created_at", "id", "is_active", "name", "updated_at" FROM "counters";
DROP TABLE "counters";
ALTER TABLE "new_counters" RENAME TO "counters";
CREATE UNIQUE INDEX "counters_code_key" ON "counters"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
