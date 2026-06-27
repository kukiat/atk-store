CREATE TYPE "auth"."auth_method" AS ENUM('google', 'facebook', 'line', 'apple', 'credentials');--> statement-breakpoint
CREATE TYPE "auth"."face_enrollment_status" AS ENUM('not_registered', 'pending', 'registered');--> statement-breakpoint
CREATE TYPE "auth"."face_liveness_intent" AS ENUM('enrollment', 'verification');--> statement-breakpoint
CREATE TYPE "auth"."face_recognition_outcome" AS ENUM('registered', 'verified', 'mismatch', 'duplicate', 'not_indexed');--> statement-breakpoint
CREATE TYPE "auth"."liveness_attempt_status" AS ENUM('pending', 'succeeded', 'failed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "auth"."face_liveness_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" text NOT NULL,
	"client_request_token" text NOT NULL,
	"intent" "auth"."face_liveness_intent" DEFAULT 'enrollment' NOT NULL,
	"status" "auth"."liveness_attempt_status" DEFAULT 'pending' NOT NULL,
	"confidence" double precision,
	"reference_s3_key" text,
	"recognition_outcome" "auth"."face_recognition_outcome",
	"matched_face_id" text,
	"matched_user_id" integer,
	"face_similarity" double precision,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "face_liveness_attempts_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"image_url" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."shelf_products" (
	"shelf_id" text NOT NULL,
	"product_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "shelf_products_shelf_id_product_id_pk" PRIMARY KEY("shelf_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."shelves" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user_face_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"collection_id" text NOT NULL,
	"face_id" text NOT NULL,
	"image_id" text,
	"external_image_id" text NOT NULL,
	"confidence" double precision,
	"reference_s3_key" text,
	"liveness_attempt_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"auth_method" "auth"."auth_method" DEFAULT 'google' NOT NULL,
	"provider_account_id" text,
	"face_enrollment_status" "auth"."face_enrollment_status" DEFAULT 'not_registered' NOT NULL,
	"face_registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auth"."face_liveness_attempts" ADD CONSTRAINT "face_liveness_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."face_liveness_attempts" ADD CONSTRAINT "face_liveness_attempts_matched_user_id_users_id_fk" FOREIGN KEY ("matched_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."shelf_products" ADD CONSTRAINT "shelf_products_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "auth"."shelves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."shelf_products" ADD CONSTRAINT "shelf_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "auth"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_face_profiles" ADD CONSTRAINT "user_face_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_face_profiles" ADD CONSTRAINT "user_face_profiles_liveness_attempt_id_face_liveness_attempts_id_fk" FOREIGN KEY ("liveness_attempt_id") REFERENCES "auth"."face_liveness_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "face_liveness_attempts_one_active_per_user" ON "auth"."face_liveness_attempts" USING btree ("user_id") WHERE "auth"."face_liveness_attempts"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "user_face_profiles_user_id_unique" ON "auth"."user_face_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_face_profiles_face_id_unique" ON "auth"."user_face_profiles" USING btree ("face_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_method_provider_account_id_unique" ON "auth"."users" USING btree ("auth_method","provider_account_id");