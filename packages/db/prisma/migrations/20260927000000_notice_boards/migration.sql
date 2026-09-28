-- CreateTable
CREATE TABLE "NoticePost" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticePost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoticePost_boardId_createdAt_idx" ON "NoticePost"("boardId", "createdAt");

-- AddForeignKey
ALTER TABLE "NoticePost" ADD CONSTRAINT "NoticePost_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticePost" ADD CONSTRAINT "NoticePost_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "spaceElements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticePost" ADD CONSTRAINT "NoticePost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

