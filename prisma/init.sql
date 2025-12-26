CREATE TYPE "HottakeStatus" AS ENUM ('OFFEN', 'WAHR', 'FALSCH');

CREATE TABLE "hottakes" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "status" "HottakeStatus" NOT NULL DEFAULT 'OFFEN',
    "gameDay" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hottakes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nickname" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "prefs" JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "submissions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gameDay" INTEGER NOT NULL,
    "picks" INTEGER[] NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_events" (
    "id" SERIAL NOT NULL,
    "gameDay" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "lockTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");

CREATE UNIQUE INDEX "submissions_userId_gameDay_key" ON "submissions"("userId", "gameDay");
CREATE INDEX "hottakes_gameDay_idx" ON "hottakes"("gameDay");
CREATE INDEX "submissions_gameDay_idx" ON "submissions"("gameDay");
CREATE UNIQUE INDEX "admin_events_gameDay_key" ON "admin_events"("gameDay");

CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

ALTER TABLE "submissions" ADD CONSTRAINT "submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_gameDay_fkey" FOREIGN KEY ("gameDay") REFERENCES "admin_events"("gameDay") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hottakes" ADD CONSTRAINT "hottakes_gameDay_fkey" FOREIGN KEY ("gameDay") REFERENCES "admin_events"("gameDay") ON DELETE RESTRICT ON UPDATE CASCADE;

