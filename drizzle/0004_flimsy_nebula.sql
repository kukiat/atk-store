CREATE TYPE "auth"."order_payment_method" AS ENUM('wallet');--> statement-breakpoint
CREATE TYPE "auth"."stripe_webhook_processing_status" AS ENUM('processing', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "auth"."wallet_funding_channel" AS ENUM('card', 'promptpay');--> statement-breakpoint
CREATE TYPE "auth"."wallet_funding_provider" AS ENUM('stripe');--> statement-breakpoint
CREATE TYPE "auth"."wallet_ledger_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "auth"."wallet_ledger_type" AS ENUM('topup_credit', 'order_debit', 'adjustment_credit', 'adjustment_debit');--> statement-breakpoint
CREATE TYPE "auth"."wallet_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "auth"."wallet_topup_status" AS ENUM('created', 'checkout_open', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "auth"."order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"ledger_entry_id" uuid,
	"payment_method" "auth"."order_payment_method" DEFAULT 'wallet' NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"status" "auth"."payment_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."stripe_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"email_snapshot" text NOT NULL,
	"livemode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"livemode" boolean DEFAULT false NOT NULL,
	"processing_status" "auth"."stripe_webhook_processing_status" DEFAULT 'processing' NOT NULL,
	"payload" jsonb NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."wallet_funding_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "auth"."wallet_funding_provider" DEFAULT 'stripe' NOT NULL,
	"channel_code" "auth"."wallet_funding_channel" NOT NULL,
	"display_name" text NOT NULL,
	"stripe_payment_method_type" text NOT NULL,
	"livemode" boolean DEFAULT false NOT NULL,
	"min_amount_minor" integer DEFAULT 1000 NOT NULL,
	"max_amount_minor" integer DEFAULT 2000000 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."wallet_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"direction" "auth"."wallet_ledger_direction" NOT NULL,
	"type" "auth"."wallet_ledger_type" NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"balance_after_minor" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."wallet_topup_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"stripe_customer_record_id" uuid,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"requested_channel" "auth"."wallet_funding_channel" NOT NULL,
	"confirmed_channel" "auth"."wallet_funding_channel",
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"status" "auth"."wallet_topup_status" DEFAULT 'created' NOT NULL,
	"livemode" boolean DEFAULT false NOT NULL,
	"checkout_url" text,
	"paid_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"balance_available_minor" integer DEFAULT 0 NOT NULL,
	"balance_pending_minor" integer DEFAULT 0 NOT NULL,
	"status" "auth"."wallet_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth"."order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "auth"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."order_payments" ADD CONSTRAINT "order_payments_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "auth"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."order_payments" ADD CONSTRAINT "order_payments_ledger_entry_id_wallet_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "auth"."wallet_ledger_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."stripe_customers" ADD CONSTRAINT "stripe_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "auth"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."wallet_topup_intents" ADD CONSTRAINT "wallet_topup_intents_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "auth"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."wallet_topup_intents" ADD CONSTRAINT "wallet_topup_intents_stripe_customer_record_id_stripe_customers_id_fk" FOREIGN KEY ("stripe_customer_record_id") REFERENCES "auth"."stripe_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_payments_order_id_unique" ON "auth"."order_payments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payments_ledger_entry_id_unique" ON "auth"."order_payments" USING btree ("ledger_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payments_idempotency_key_unique" ON "auth"."order_payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_customers_user_livemode_unique" ON "auth"."stripe_customers" USING btree ("user_id","livemode");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_customers_provider_id_livemode_unique" ON "auth"."stripe_customers" USING btree ("stripe_customer_id","livemode");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_events_event_id_unique" ON "auth"."stripe_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_funding_channels_provider_code_livemode_unique" ON "auth"."wallet_funding_channels" USING btree ("provider","channel_code","livemode");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_entries_idempotency_key_unique" ON "auth"."wallet_ledger_entries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_topup_intents_checkout_session_unique" ON "auth"."wallet_topup_intents" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_topup_intents_payment_intent_unique" ON "auth"."wallet_topup_intents" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_id_unique" ON "auth"."wallets" USING btree ("user_id");