CREATE TABLE "data_exports" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"status" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"downloaded_at" timestamp with time zone,
	"key_hash" text,
	"file_key" text,
	"byte_size" integer,
	CONSTRAINT "data_exports_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "data_exports_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "stored_files" (
	"key" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_exports_user_requested" ON "data_exports" USING btree ("user_id","requested_at");--> statement-breakpoint
CREATE INDEX "stored_files_expires" ON "stored_files" USING btree ("expires_at");