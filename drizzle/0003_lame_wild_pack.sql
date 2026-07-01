CREATE TYPE "auth"."notification_recipient_type" AS ENUM('client', 'admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "auth"."notification_severity" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "auth"."order_status" AS ENUM('pending', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "auth"."payment_status" AS ENUM('pending', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "auth"."groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."inventories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelf_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" double precision NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"weight_per_piece" double precision NOT NULL,
	"unit_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_visit_id" integer,
	"recipient_type" "auth"."notification_recipient_type" NOT NULL,
	"user_id" integer,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"severity" "auth"."notification_severity" DEFAULT 'info' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"inventory_id" uuid,
	"name" text NOT NULL,
	"price" double precision NOT NULL,
	"amount" integer NOT NULL,
	"weight_per_piece" double precision NOT NULL,
	"unit_id" uuid,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_visit_id" integer NOT NULL,
	"status" "auth"."order_status" DEFAULT 'paid' NOT NULL,
	"payment_status" "auth"."payment_status" DEFAULT 'paid' NOT NULL,
	"total_price" double precision DEFAULT 0 NOT NULL,
	"payment_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text,
	"shelf_ids" text NOT NULL,
	"encoded_payload" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."shelfs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"name" text NOT NULL,
	"image_url" text,
	"sensor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "units_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DROP TABLE "auth"."products" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."shelf_products" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."shelves" CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."inventories" ADD CONSTRAINT "inventories_shelf_id_shelfs_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "auth"."shelfs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."inventories" ADD CONSTRAINT "inventories_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "auth"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."notifications" ADD CONSTRAINT "notifications_client_visit_id_client_visits_id_fk" FOREIGN KEY ("client_visit_id") REFERENCES "auth"."client_visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "auth"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."order_items" ADD CONSTRAINT "order_items_inventory_id_inventories_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "auth"."inventories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."order_items" ADD CONSTRAINT "order_items_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "auth"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."orders" ADD CONSTRAINT "orders_client_visit_id_client_visits_id_fk" FOREIGN KEY ("client_visit_id") REFERENCES "auth"."client_visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."shelfs" ADD CONSTRAINT "shelfs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "auth"."groups"("id") ON DELETE set null ON UPDATE no action;