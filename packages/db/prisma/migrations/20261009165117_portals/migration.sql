-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "SpacePortal" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "targetSpaceId" TEXT NOT NULL,
    "targetX" INTEGER NOT NULL,
    "targetY" INTEGER NOT NULL,

    CONSTRAINT "SpacePortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapPortal" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "targetMapId" TEXT NOT NULL,
    "targetX" INTEGER NOT NULL,
    "targetY" INTEGER NOT NULL,

    CONSTRAINT "MapPortal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpacePortal_spaceId_idx" ON "SpacePortal"("spaceId");

-- CreateIndex
CREATE INDEX "MapPortal_mapId_idx" ON "MapPortal"("mapId");

-- CreateIndex
CREATE INDEX "Space_parentId_idx" ON "Space"("parentId");

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacePortal" ADD CONSTRAINT "SpacePortal_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacePortal" ADD CONSTRAINT "SpacePortal_targetSpaceId_fkey" FOREIGN KEY ("targetSpaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapPortal" ADD CONSTRAINT "MapPortal_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapPortal" ADD CONSTRAINT "MapPortal_targetMapId_fkey" FOREIGN KEY ("targetMapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;
