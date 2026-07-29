CREATE TABLE "auth"."navigation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"client_visit_id" integer NOT NULL,
	"anchor_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"status" text DEFAULT 'navigating' NOT NULL,
	"mode" text DEFAULT 'map' NOT NULL,
	"initial_distance_meters" double precision NOT NULL,
	"last_x" double precision NOT NULL,
	"last_z" double precision NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth"."navigation_sessions" ADD CONSTRAINT "navigation_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."navigation_sessions" ADD CONSTRAINT "navigation_sessions_client_visit_id_client_visits_id_fk" FOREIGN KEY ("client_visit_id") REFERENCES "auth"."client_visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."navigation_sessions" ADD CONSTRAINT "navigation_sessions_anchor_id_navigation_anchors_id_fk" FOREIGN KEY ("anchor_id") REFERENCES "auth"."navigation_anchors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."navigation_sessions" ADD CONSTRAINT "navigation_sessions_destination_id_inventory_navigation_locations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "auth"."inventory_navigation_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "navigation_sessions_user_idx" ON "auth"."navigation_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "navigation_sessions_visit_idx" ON "auth"."navigation_sessions" USING btree ("client_visit_id");--> statement-breakpoint
CREATE INDEX "navigation_sessions_started_at_idx" ON "auth"."navigation_sessions" USING btree ("started_at");