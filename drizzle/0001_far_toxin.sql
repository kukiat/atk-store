CREATE TYPE "auth"."role_grant_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "auth"."user_account_status" AS ENUM('active', 'blocked', 'disabled');--> statement-breakpoint
CREATE TABLE "auth"."admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"target_user_id" integer,
	"action" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."role_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role_id" integer NOT NULL,
	"status" "auth"."role_grant_status" DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" integer,
	"accepted_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
INSERT INTO "auth"."roles" ("code", "name") VALUES
	('client', 'Client'),
	('admin', 'Admin'),
	('super_admin', 'Super Admin')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
CREATE TABLE "auth"."user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"assigned_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "account_status" "auth"."user_account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "disabled_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "disabled_reason" text;--> statement-breakpoint
ALTER TABLE "auth"."admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."role_grants" ADD CONSTRAINT "role_grants_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."role_grants" ADD CONSTRAINT "role_grants_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."role_grants" ADD CONSTRAINT "role_grants_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "role_grants_email_role_pending_unique" ON "auth"."role_grants" USING btree ("email","role_id") WHERE "auth"."role_grants"."status" = 'pending';
