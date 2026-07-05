CREATE TYPE "auth"."receipt_status" AS ENUM('issued', 'voided', 'refunded');--> statement-breakpoint
CREATE TABLE "auth"."receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"order_item_id" uuid,
	"inventory_id" uuid,
	"shelf_id" uuid,
	"name" text NOT NULL,
	"unit_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"line_subtotal_minor" integer NOT NULL,
	"vat_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"line_total_minor" integer NOT NULL,
	"weight_per_piece" double precision NOT NULL,
	"image_url" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"client_visit_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"receipt_no" text NOT NULL,
	"status" "auth"."receipt_status" DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_name" text,
	"customer_email" text NOT NULL,
	"store_name" text NOT NULL,
	"store_legal_name" text,
	"store_tax_id" text,
	"store_address" text,
	"store_phone" text,
	"store_email" text,
	"subtotal_minor" integer NOT NULL,
	"vat_percent" double precision DEFAULT 0 NOT NULL,
	"vat_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"payment_method" text DEFAULT 'wallet' NOT NULL,
	"payment_reference" text,
	"wallet_balance_after_minor" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."store_settings" (
	"key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"store_name" text DEFAULT 'ATK Store' NOT NULL,
	"store_legal_name" text,
	"store_tax_id" text,
	"store_address" text,
	"store_phone" text,
	"store_email" text,
	"vat_percent" double precision DEFAULT 0 NOT NULL,
	"receipt_prefix" text DEFAULT 'RC' NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth"."receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "auth"."receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."receipt_items" ADD CONSTRAINT "receipt_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "auth"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."receipt_items" ADD CONSTRAINT "receipt_items_inventory_id_inventories_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "auth"."inventories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."receipt_items" ADD CONSTRAINT "receipt_items_shelf_id_shelfs_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "auth"."shelfs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."receipts" ADD CONSTRAINT "receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "auth"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."receipts" ADD CONSTRAINT "receipts_client_visit_id_client_visits_id_fk" FOREIGN KEY ("client_visit_id") REFERENCES "auth"."client_visits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."receipts" ADD CONSTRAINT "receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_order_id_unique" ON "auth"."receipts" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_receipt_no_unique" ON "auth"."receipts" USING btree ("receipt_no");