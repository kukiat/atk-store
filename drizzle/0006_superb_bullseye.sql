ALTER TABLE "auth"."inventories" DROP CONSTRAINT "inventories_shelf_id_shelfs_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."inventories" ALTER COLUMN "shelf_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."inventories" ADD CONSTRAINT "inventories_shelf_id_shelfs_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "auth"."shelfs"("id") ON DELETE set null ON UPDATE no action;