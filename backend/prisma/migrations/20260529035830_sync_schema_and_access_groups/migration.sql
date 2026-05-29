-- AlterTable
ALTER TABLE "journey_unit_sessions" ADD COLUMN "service_name" TEXT;

-- CreateTable
CREATE TABLE "access_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_displays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_type" TEXT NOT NULL,
    "floor_id" TEXT,
    "orientation" TEXT NOT NULL DEFAULT 'LANDSCAPE',
    "video_playlist_id" TEXT,
    "running_text" TEXT,
    "video_volume" REAL NOT NULL DEFAULT 0.3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "displays_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "displays_video_playlist_id_fkey" FOREIGN KEY ("video_playlist_id") REFERENCES "video_playlists" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_displays" ("code", "display_type", "floor_id", "id", "is_active", "name", "orientation", "running_text", "video_playlist_id") SELECT "code", "display_type", "floor_id", "id", "is_active", "name", "orientation", "running_text", "video_playlist_id" FROM "displays";
DROP TABLE "displays";
ALTER TABLE "new_displays" RENAME TO "displays";
CREATE UNIQUE INDEX "displays_code_key" ON "displays"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "access_groups_role_key" ON "access_groups"("role");
