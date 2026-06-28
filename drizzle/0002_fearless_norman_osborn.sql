CREATE TYPE "auth"."attendance_direction" AS ENUM('entry', 'exit', 'sighting');--> statement-breakpoint
CREATE TYPE "auth"."attendance_recognition_decision" AS ENUM('recognized', 'unknown', 'ignored');--> statement-breakpoint
CREATE TYPE "auth"."client_visit_status" AS ENUM('inside', 'exited', 'unknown_exit');--> statement-breakpoint
CREATE TABLE "auth"."client_attendance_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"camera_id" text NOT NULL,
	"direction" "auth"."attendance_direction" NOT NULL,
	"decision" "auth"."attendance_recognition_decision" NOT NULL,
	"matched_user_id" integer,
	"matched_face_id" text,
	"similarity" double precision,
	"image_sha256" text NOT NULL,
	"worker_captured_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."client_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" "auth"."client_visit_status" DEFAULT 'inside' NOT NULL,
	"entered_at" timestamp with time zone NOT NULL,
	"exited_at" timestamp with time zone,
	"entry_event_id" integer,
	"exit_event_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."client_attendance_events" ADD CONSTRAINT "client_attendance_events_matched_user_id_users_id_fk" FOREIGN KEY ("matched_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."client_visits" ADD CONSTRAINT "client_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_visits_one_open_per_user" ON "auth"."client_visits" USING btree ("user_id") WHERE "auth"."client_visits"."status" = 'inside';