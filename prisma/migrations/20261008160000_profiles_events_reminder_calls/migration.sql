-- Richer profiles (mobile, bio, skills, hobbies, photo), event end times,
-- types, prizes, entry fee and cover images, and the tables behind Aanaya's
-- reminder calls. Everything is additive: no existing column changes.
-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "avatarPath" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "callLanguage" TEXT NOT NULL DEFAULT 'hi',
ADD COLUMN     "city" TEXT,
ADD COLUMN     "college" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "hobbies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "coverPath" TEXT,
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "entryFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prizes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "reminderArriveEarly" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderLanguage" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "reminderQueuedAt" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "callLanguage" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "ReminderCall" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "providerCallId" TEXT,
    "promptId" TEXT,
    "transcript" TEXT,
    "intent" TEXT,
    "durationSec" INTEGER,
    "hangupCause" TEXT,
    "error" TEXT,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicePrompt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoicePrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderCall_providerCallId_key" ON "ReminderCall"("providerCallId");

-- CreateIndex
CREATE INDEX "ReminderCall_eventId_status_createdAt_idx" ON "ReminderCall"("eventId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderCall_registrationId_createdAt_idx" ON "ReminderCall"("registrationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderCall_status_updatedAt_idx" ON "ReminderCall"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoicePrompt_eventId_language_signature_key" ON "VoicePrompt"("eventId", "language", "signature");

-- CreateIndex
CREATE INDEX "Event_reminderEnabled_reminderQueuedAt_idx" ON "Event"("reminderEnabled", "reminderQueuedAt");

-- AddForeignKey
ALTER TABLE "ReminderCall" ADD CONSTRAINT "ReminderCall_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderCall" ADD CONSTRAINT "ReminderCall_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderCall" ADD CONSTRAINT "ReminderCall_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "VoicePrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoicePrompt" ADD CONSTRAINT "VoicePrompt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same lock-down as the original tables: the app only talks to these through
-- Prisma (as `postgres`), so the public REST API gets nothing.
ALTER TABLE "ReminderCall" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VoicePrompt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ReminderCall", "VoicePrompt" FROM anon, authenticated;
