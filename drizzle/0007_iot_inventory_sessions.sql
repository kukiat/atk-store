CREATE TYPE "auth"."iot_session_status" AS ENUM('open', 'updated', 'closed', 'expired');--> statement-breakpoint
CREATE TYPE "auth"."iot_session_event_message_kind" AS ENUM('event', 'status');--> statement-breakpoint
CREATE TYPE "auth"."iot_session_event_type" AS ENUM('picked_count', 'door_closed', 'error');--> statement-breakpoint
ALTER TABLE "auth"."receipt_items" DROP CONSTRAINT IF EXISTS "receipt_items_shelf_id_shelfs_id_fk";--> statement-breakpoint
ALTER TABLE "auth"."inventories" DROP CONSTRAINT IF EXISTS "inventories_shelf_id_shelfs_id_fk";--> statement-breakpoint
DELETE FROM "auth"."qr_codes";--> statement-breakpoint
ALTER TABLE "auth"."qr_codes" RENAME COLUMN "shelf_ids" TO "inventory_ids";--> statement-breakpoint
ALTER TABLE "auth"."receipt_items" DROP COLUMN IF EXISTS "shelf_id";--> statement-breakpoint
ALTER TABLE "auth"."inventories" DROP COLUMN IF EXISTS "shelf_id";--> statement-breakpoint
DROP TABLE IF EXISTS "auth"."shelfs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "auth"."groups" CASCADE;--> statement-breakpoint
CREATE TABLE "auth"."iot_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_visit_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"inventory_id" uuid NOT NULL,
	"branch_code" text NOT NULL,
	"status" "auth"."iot_session_status" DEFAULT 'open' NOT NULL,
	"picked_count" integer DEFAULT 0 NOT NULL,
	"current_qty" integer,
	"in_store_qty" integer,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "auth"."iot_session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"inventory_id" uuid NOT NULL,
	"branch_code" text NOT NULL,
	"message_kind" "auth"."iot_session_event_message_kind" NOT NULL,
	"event_type" "auth"."iot_session_event_type" NOT NULL,
	"seq" integer,
	"raw_payload" jsonb,
	"occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "auth"."iot_sessions" ADD CONSTRAINT "iot_sessions_client_visit_id_client_visits_id_fk" FOREIGN KEY ("client_visit_id") REFERENCES "auth"."client_visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."iot_sessions" ADD CONSTRAINT "iot_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."iot_sessions" ADD CONSTRAINT "iot_sessions_inventory_id_inventories_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "auth"."inventories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."iot_session_events" ADD CONSTRAINT "iot_session_events_session_id_iot_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth"."iot_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."iot_session_events" ADD CONSTRAINT "iot_session_events_inventory_id_inventories_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "auth"."inventories"("id") ON DELETE restrict ON UPDATE no action;
