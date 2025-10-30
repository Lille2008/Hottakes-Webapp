-- Datenbankschema (SQL): entspricht dem Prisma-Schema und erstellt Tabellen/Indizes
-- CreateEnum
CREATE TYPE "HottakeStatus" AS ENUM ('OFFEN', 'WAHR', 'FALSCH');

-- CreateTable: Hottakes
CREATE TABLE "hottakes" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "status" "HottakeStatus" NOT NULL DEFAULT 'OFFEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hottakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Users
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nickname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Submissions (eine pro User)
CREATE TABLE "submissions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "picks" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Einstellungen (Key/Value)
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Admin-Events (optional)
CREATE TABLE "admin_events" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "lockTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_events_pkey" PRIMARY KEY ("id")
);

-- Eindeutige Nicknames
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");

-- Pro User genau eine Submission
CREATE UNIQUE INDEX "submissions_userId_key" ON "submissions"("userId");

-- Settings-Key eindeutig
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- Fremdschlüssel von submissions.userId -> users.id
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

