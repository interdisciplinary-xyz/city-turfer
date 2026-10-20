CREATE TABLE "activities" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"time_zone" text,
	"resumed_segments" jsonb,
	"track_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"summary" jsonb NOT NULL,
	"estimated_distance_m" double precision DEFAULT 0 NOT NULL,
	"estimated_moving_s" integer DEFAULT 0 NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"change_seq" bigint NOT NULL,
	CONSTRAINT "activities_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "activity_tracks" (
	"user_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"points" jsonb NOT NULL,
	CONSTRAINT "activity_tracks_user_id_activity_id_pk" PRIMARY KEY("user_id","activity_id")
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"policy_version" text NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "consents_user_id_purpose_pk" PRIMARY KEY("user_id","purpose")
);
--> statement-breakpoint
CREATE TABLE "gap_routes" (
	"user_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"routes" jsonb NOT NULL,
	CONSTRAINT "gap_routes_user_id_activity_id_pk" PRIMARY KEY("user_id","activity_id")
);
--> statement-breakpoint
CREATE TABLE "home_cities" (
	"user_id" text PRIMARY KEY NOT NULL,
	"city_id" text,
	"chosen_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"change_seq" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tombstones" (
	"user_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"deleted_at" timestamp with time zone NOT NULL,
	"change_seq" bigint NOT NULL,
	CONSTRAINT "tombstones_user_id_activity_id_pk" PRIMARY KEY("user_id","activity_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"change_seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_tracks" ADD CONSTRAINT "activity_tracks_user_id_activity_id_activities_user_id_id_fk" FOREIGN KEY ("user_id","activity_id") REFERENCES "public"."activities"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_routes" ADD CONSTRAINT "gap_routes_user_id_activity_id_activities_user_id_id_fk" FOREIGN KEY ("user_id","activity_id") REFERENCES "public"."activities"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_cities" ADD CONSTRAINT "home_cities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tombstones" ADD CONSTRAINT "tombstones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_user_seq" ON "activities" USING btree ("user_id","change_seq");--> statement-breakpoint
CREATE INDEX "activities_user_started" ON "activities" USING btree ("user_id","started_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tombstones_user_seq" ON "tombstones" USING btree ("user_id","change_seq");