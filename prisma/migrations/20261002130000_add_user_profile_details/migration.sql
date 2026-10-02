-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3);
