/*
  Warnings:

  - Added the required column `layer` to the `Element` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Layer" AS ENUM ('floor', 'wall', 'objects', 'topObjects');

-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "layer" "Layer" NOT NULL;
