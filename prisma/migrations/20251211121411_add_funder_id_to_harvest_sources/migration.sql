-- AlterTable
ALTER TABLE "harvest_sources" ADD COLUMN     "funder_id" UUID;

-- AddForeignKey
ALTER TABLE "harvest_sources" ADD CONSTRAINT "harvest_sources_funder_id_fkey" FOREIGN KEY ("funder_id") REFERENCES "funders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
