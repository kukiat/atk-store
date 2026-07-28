CREATE TABLE "auth"."inventory_navigation_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_id" uuid NOT NULL,
	"floor_id" uuid NOT NULL,
	"label" text NOT NULL,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."navigation_anchors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL,
	"height_meters" double precision NOT NULL,
	"width_meters" double precision NOT NULL,
	"sign_height_meters" double precision NOT NULL,
	"yaw_degrees" double precision NOT NULL,
	"start_x" double precision NOT NULL,
	"start_z" double precision NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."navigation_floors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"width_meters" double precision NOT NULL,
	"length_meters" double precision NOT NULL,
	"boundary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."navigation_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"points" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."navigation_restricted_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"polygon" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth"."inventory_navigation_locations" ADD CONSTRAINT "inventory_navigation_locations_inventory_id_inventories_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "auth"."inventories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."inventory_navigation_locations" ADD CONSTRAINT "inventory_navigation_locations_floor_id_navigation_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "auth"."navigation_floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."navigation_anchors" ADD CONSTRAINT "navigation_anchors_floor_id_navigation_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "auth"."navigation_floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."navigation_paths" ADD CONSTRAINT "navigation_paths_floor_id_navigation_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "auth"."navigation_floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."navigation_restricted_areas" ADD CONSTRAINT "navigation_restricted_areas_floor_id_navigation_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "auth"."navigation_floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_navigation_locations_floor_idx" ON "auth"."inventory_navigation_locations" USING btree ("floor_id");--> statement-breakpoint
CREATE INDEX "inventory_navigation_locations_inventory_idx" ON "auth"."inventory_navigation_locations" USING btree ("inventory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_anchors_floor_code_unique" ON "auth"."navigation_anchors" USING btree ("floor_id","code");--> statement-breakpoint
CREATE INDEX "navigation_anchors_floor_idx" ON "auth"."navigation_anchors" USING btree ("floor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_floors_code_unique" ON "auth"."navigation_floors" USING btree ("code");--> statement-breakpoint
CREATE INDEX "navigation_paths_floor_idx" ON "auth"."navigation_paths" USING btree ("floor_id");--> statement-breakpoint
CREATE INDEX "navigation_restricted_areas_floor_idx" ON "auth"."navigation_restricted_areas" USING btree ("floor_id");