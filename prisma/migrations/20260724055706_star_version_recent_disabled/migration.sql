-- AlterTable
ALTER TABLE "FileObject" ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastAccessedAt" TIMESTAMP(3),
ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "versionGroupId" TEXT;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "lastAccessedAt" TIMESTAMP(3),
ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "FileObject_ownerId_starred_idx" ON "FileObject"("ownerId", "starred");

-- CreateIndex
CREATE INDEX "FileObject_ownerId_lastAccessedAt_idx" ON "FileObject"("ownerId", "lastAccessedAt");

-- CreateIndex
CREATE INDEX "FileObject_versionGroupId_idx" ON "FileObject"("versionGroupId");

-- CreateIndex
CREATE INDEX "FileObject_ownerId_folderId_name_isLatest_idx" ON "FileObject"("ownerId", "folderId", "name", "isLatest");

-- CreateIndex
CREATE INDEX "Folder_ownerId_starred_idx" ON "Folder"("ownerId", "starred");

-- CreateIndex
CREATE INDEX "Folder_ownerId_lastAccessedAt_idx" ON "Folder"("ownerId", "lastAccessedAt");
