-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "weatherLatitude" DECIMAL(8,5) NOT NULL DEFAULT 17.9583,
ADD COLUMN     "weatherLongitude" DECIMAL(8,5) NOT NULL DEFAULT -102.1944,
ADD COLUMN     "weatherPlace" TEXT NOT NULL DEFAULT 'Lázaro Cárdenas, Mich.';
