-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN "counter_name" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "human_description" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "patient_name" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "ticket_no" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "unit_type" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "user_name" TEXT;

-- CreateTable
CREATE TABLE "video_display_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "video_item_id" TEXT NOT NULL,
    "display_id" TEXT NOT NULL,
    CONSTRAINT "video_display_targets_video_item_id_fkey" FOREIGN KEY ("video_item_id") REFERENCES "video_playlist_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_display_targets_display_id_fkey" FOREIGN KEY ("display_id") REFERENCES "displays" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "video_display_targets_video_item_id_display_id_key" ON "video_display_targets"("video_item_id", "display_id");
