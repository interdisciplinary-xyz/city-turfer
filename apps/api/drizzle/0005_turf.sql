CREATE TABLE "turf_cells" (
	"user_id" text NOT NULL,
	"cell" text NOT NULL,
	"walk" integer DEFAULT 0 NOT NULL,
	"run" integer DEFAULT 0 NOT NULL,
	"cycle" integer DEFAULT 0 NOT NULL,
	"first_at" timestamp with time zone NOT NULL,
	"first_activity_id" text NOT NULL,
	CONSTRAINT "turf_cells_user_id_cell_pk" PRIMARY KEY("user_id","cell")
);
--> statement-breakpoint
CREATE TABLE "turf_claims" (
	"user_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"type" text NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	"cells" text[] NOT NULL,
	CONSTRAINT "turf_claims_user_id_activity_id_pk" PRIMARY KEY("user_id","activity_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "turf_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "turf_cells" ADD CONSTRAINT "turf_cells_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turf_claims" ADD CONSTRAINT "turf_claims_user_id_activity_id_activities_user_id_id_fk" FOREIGN KEY ("user_id","activity_id") REFERENCES "public"."activities"("user_id","id") ON DELETE cascade ON UPDATE no action;