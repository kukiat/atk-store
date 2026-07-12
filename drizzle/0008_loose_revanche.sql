CREATE TYPE "auth"."iot_mqtt_message_processing_status" AS ENUM('received', 'processed', 'rejected', 'failed');--> statement-breakpoint
CREATE TABLE "auth"."iot_mqtt_message_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"session_id" text,
	"inventory_id" text,
	"branch_code" text,
	"message_kind" text,
	"processing_status" "auth"."iot_mqtt_message_processing_status" DEFAULT 'received' NOT NULL,
	"reason_code" text,
	"error_message" text,
	"payload_raw" text NOT NULL,
	"payload_json" jsonb,
	"payload_size_bytes" integer NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "iot_mqtt_message_logs_received_at_idx" ON "auth"."iot_mqtt_message_logs" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "iot_mqtt_message_logs_processing_status_idx" ON "auth"."iot_mqtt_message_logs" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "iot_mqtt_message_logs_session_id_idx" ON "auth"."iot_mqtt_message_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "iot_mqtt_message_logs_inventory_id_idx" ON "auth"."iot_mqtt_message_logs" USING btree ("inventory_id");