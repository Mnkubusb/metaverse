-- DropForeignKey
ALTER TABLE "mapElements" DROP CONSTRAINT "mapElements_mapId_fkey";

-- AddForeignKey
ALTER TABLE "mapElements" ADD CONSTRAINT "mapElements_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;
