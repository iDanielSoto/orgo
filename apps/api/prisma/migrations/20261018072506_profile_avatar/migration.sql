-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "avatar" BYTEA,
ADD COLUMN     "avatarMime" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMPTZ(3);
