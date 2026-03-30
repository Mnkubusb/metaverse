/*
  Warnings:

  - Made the column `x` on table `mapElements` required. This step will fail if there are existing NULL values in that column.
  - Made the column `y` on table `mapElements` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "mapElements" ALTER COLUMN "x" SET NOT NULL,
ALTER COLUMN "y" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Space_creatorId_idx" ON "Space"("creatorId");

-- CreateIndex
CREATE INDEX "mapElements_mapId_idx" ON "mapElements"("mapId");

-- CreateIndex
CREATE INDEX "spaceElements_spaceId_idx" ON "spaceElements"("spaceId");

-- CreateIndex
CREATE INDEX "spaceElements_elementId_idx" ON "spaceElements"("elementId");
