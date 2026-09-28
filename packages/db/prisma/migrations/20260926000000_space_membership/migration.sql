-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('Private', 'Unlisted', 'Public');

-- CreateEnum
CREATE TYPE "SpaceRole" AS ENUM ('Owner', 'Member');

-- AlterTable
-- Existing spaces become Unlisted (anyone with the link), which is how every space behaved before.
ALTER TABLE "Space" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'Unlisted';

-- Give existing spaces a random invite code, then require one (Prisma generates it for new rows)
UPDATE "Space" SET "inviteCode" = md5(random()::text || clock_timestamp()::text || "id") WHERE "inviteCode" IS NULL;
ALTER TABLE "Space" ALTER COLUMN "inviteCode" SET NOT NULL;

-- CreateTable
CREATE TABLE "SpaceMember" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SpaceRole" NOT NULL DEFAULT 'Member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("spaceId","userId")
);

-- CreateIndex
CREATE INDEX "SpaceMember_userId_idx" ON "SpaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Space_inviteCode_key" ON "Space"("inviteCode");

-- CreateIndex
CREATE INDEX "Space_visibility_createdAt_idx" ON "Space"("visibility", "createdAt");

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every existing space's creator becomes its Owner
INSERT INTO "SpaceMember" ("spaceId", "userId", "role")
SELECT "id", "creatorId", 'Owner' FROM "Space"
ON CONFLICT DO NOTHING;
