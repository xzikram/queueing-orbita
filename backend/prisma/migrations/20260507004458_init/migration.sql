-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "counters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "can_handle_admission" BOOLEAN NOT NULL DEFAULT true,
    "can_handle_cashier" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "floor_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room_type" TEXT NOT NULL,
    "floor_id" TEXT,
    "has_calling" BOOLEAN NOT NULL DEFAULT false,
    "display_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "rooms_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "rooms_display_id_fkey" FOREIGN KEY ("display_id") REFERENCES "displays" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctor_code" TEXT NOT NULL,
    "doctor_name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "default_room_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "doctors_default_room_id_fkey" FOREIGN KEY ("default_room_id") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "doctor_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_date" DATETIME NOT NULL,
    "day_name" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "floor_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "quota" INTEGER NOT NULL,
    "booked_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "import_batch_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "doctor_schedules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "doctor_schedules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "doctor_schedules_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "doctor_schedules_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "schedule_import_batches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedule_import_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "error_log" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_import_batches_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "queue_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticket_no" TEXT NOT NULL,
    "queue_date" DATETIME NOT NULL,
    "patient_type" TEXT NOT NULL,
    "selected_schedule_id" TEXT,
    "selected_doctor_id" TEXT,
    "selected_room_id" TEXT,
    "selected_floor_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "queue_tickets_selected_schedule_id_fkey" FOREIGN KEY ("selected_schedule_id") REFERENCES "doctor_schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "queue_tickets_selected_doctor_id_fkey" FOREIGN KEY ("selected_doctor_id") REFERENCES "doctors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "queue_tickets_selected_room_id_fkey" FOREIGN KEY ("selected_room_id") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "queue_tickets_selected_floor_id_fkey" FOREIGN KEY ("selected_floor_id") REFERENCES "floors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visit_code" TEXT NOT NULL,
    "queue_ticket_id" TEXT NOT NULL,
    "visit_date" DATETIME NOT NULL,
    "patient_rm_no" TEXT,
    "patient_name" TEXT,
    "patient_dob" DATETIME,
    "patient_type" TEXT NOT NULL,
    "selected_doctor_id" TEXT,
    "selected_schedule_id" TEXT,
    "selected_room_id" TEXT,
    "selected_floor_id" TEXT,
    "current_unit_type" TEXT,
    "current_room_id" TEXT,
    "current_status" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "finished_at" DATETIME,
    CONSTRAINT "visits_queue_ticket_id_fkey" FOREIGN KEY ("queue_ticket_id") REFERENCES "queue_tickets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "visits_selected_doctor_id_fkey" FOREIGN KEY ("selected_doctor_id") REFERENCES "doctors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "visits_selected_schedule_id_fkey" FOREIGN KEY ("selected_schedule_id") REFERENCES "doctor_schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "visits_selected_room_id_fkey" FOREIGN KEY ("selected_room_id") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "visits_selected_floor_id_fkey" FOREIGN KEY ("selected_floor_id") REFERENCES "floors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "visits_current_room_id_fkey" FOREIGN KEY ("current_room_id") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journey_unit_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visit_id" TEXT NOT NULL,
    "unit_type" TEXT NOT NULL,
    "unit_id" TEXT,
    "room_id" TEXT,
    "floor_id" TEXT,
    "doctor_id" TEXT,
    "counter_id" TEXT,
    "queue_ticket_id" TEXT,
    "waiting_started_at" DATETIME,
    "called_at" DATETIME,
    "service_started_at" DATETIME,
    "ready_at" DATETIME,
    "service_finished_at" DATETIME,
    "waiting_duration_seconds" INTEGER,
    "service_duration_seconds" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "is_time_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_reason" TEXT,
    "edited_by" TEXT,
    "edited_at" DATETIME,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "journey_unit_sessions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "journey_unit_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "journey_unit_sessions_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "journey_unit_sessions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "journey_unit_sessions_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "counters" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "journey_unit_sessions_queue_ticket_id_fkey" FOREIGN KEY ("queue_ticket_id") REFERENCES "queue_tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journey_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visit_id" TEXT NOT NULL,
    "journey_unit_session_id" TEXT,
    "unit_type" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_time" DATETIME NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "room_id" TEXT,
    "floor_id" TEXT,
    "counter_id" TEXT,
    "doctor_id" TEXT,
    "created_by" TEXT,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journey_events_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "journey_events_journey_unit_session_id_fkey" FOREIGN KEY ("journey_unit_session_id") REFERENCES "journey_unit_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "journey_events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "journey_events_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "journey_events_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "displays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_type" TEXT NOT NULL,
    "floor_id" TEXT,
    "orientation" TEXT NOT NULL DEFAULT 'LANDSCAPE',
    "video_playlist_id" TEXT,
    "running_text" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "displays_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "displays_video_playlist_id_fkey" FOREIGN KEY ("video_playlist_id") REFERENCES "video_playlists" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "display_call_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "display_id" TEXT NOT NULL,
    "visit_id" TEXT,
    "queue_ticket_id" TEXT,
    "ticket_no" TEXT NOT NULL,
    "call_text" TEXT,
    "target_room" TEXT,
    "target_counter" TEXT,
    "unit_type" TEXT NOT NULL,
    "called_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "display_call_logs_display_id_fkey" FOREIGN KEY ("display_id") REFERENCES "displays" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "display_call_logs_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "display_call_logs_queue_ticket_id_fkey" FOREIGN KEY ("queue_ticket_id") REFERENCES "queue_tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "video_playlists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "video_playlist_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlist_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "video_playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "video_playlists" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "counters_code_key" ON "counters"("code");

-- CreateIndex
CREATE UNIQUE INDEX "floors_floor_number_key" ON "floors"("floor_number");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_doctor_code_key" ON "doctors"("doctor_code");

-- CreateIndex
CREATE UNIQUE INDEX "queue_tickets_ticket_no_queue_date_key" ON "queue_tickets"("ticket_no", "queue_date");

-- CreateIndex
CREATE UNIQUE INDEX "visits_visit_code_key" ON "visits"("visit_code");

-- CreateIndex
CREATE UNIQUE INDEX "visits_queue_ticket_id_key" ON "visits"("queue_ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "displays_code_key" ON "displays"("code");
