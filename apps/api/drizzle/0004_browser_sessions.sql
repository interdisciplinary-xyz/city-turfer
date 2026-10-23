ALTER TABLE "auth_sessions" ADD COLUMN "client" text DEFAULT 'phone' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "absolute_expires_at" timestamp with time zone;