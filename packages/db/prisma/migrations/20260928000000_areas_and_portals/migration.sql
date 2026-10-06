-- Interior areas (building insides) and the doors that lead between them.
-- `areas` lists the extra areas of a map/space: [{ id, name, width, height, spawnX, spawnY, ground }].
-- Placements belong to one area ("main" = the outdoor map). A placement with toArea/toX/toY
-- is a door: stepping on its tile moves the player to that tile of that area.
ALTER TABLE "Map" ADD COLUMN "areas" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Space" ADD COLUMN "areas" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "mapElements" ADD COLUMN "area" TEXT NOT NULL DEFAULT 'main',
    ADD COLUMN "toArea" TEXT,
    ADD COLUMN "toX" INTEGER,
    ADD COLUMN "toY" INTEGER;

ALTER TABLE "spaceElements" ADD COLUMN "area" TEXT NOT NULL DEFAULT 'main',
    ADD COLUMN "toArea" TEXT,
    ADD COLUMN "toX" INTEGER,
    ADD COLUMN "toY" INTEGER;
