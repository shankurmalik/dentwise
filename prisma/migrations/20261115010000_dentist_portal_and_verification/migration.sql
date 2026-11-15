-- Apply only to an approved development database. This migration is additive and
-- keeps existing doctors approved and existing appointments intact.
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'DENTIST', 'ADMIN');
CREATE TYPE "DoctorApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_STARTED', 'AWAITING_PATIENT', 'VERIFIED', 'DISPUTED', 'EXPIRED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'OTHER');
CREATE TYPE "CommissionStatus" AS ENUM ('DUE', 'SETTLED', 'DISPUTED');

ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'PATIENT';

ALTER TABLE "doctors"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "approvalStatus" "DoctorApproval" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "licenseNumber" TEXT,
  ADD COLUMN "clinicAddress" TEXT,
  ADD COLUMN "consultationFee" DECIMAL(10, 2) NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "doctors_userId_key" ON "doctors"("userId");
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointments"
  ADD COLUMN "consultationFee" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "actualAmountCollected" DECIMAL(10, 2),
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "dentistReportedAmount" DECIMAL(10, 2),
  ADD COLUMN "dentistPaymentMethod" "PaymentMethod",
  ADD COLUMN "dentistReportedAt" TIMESTAMP(3),
  ADD COLUMN "patientReportedAmount" DECIMAL(10, 2),
  ADD COLUMN "patientPaymentMethod" "PaymentMethod",
  ADD COLUMN "patientReportedAt" TIMESTAMP(3),
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "dentistConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "patientConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "verificationDeadline" TIMESTAMP(3),
  ADD COLUMN "patientReminderSentAt" TIMESTAMP(3);

CREATE TABLE "commissions" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "collectedAmount" DECIMAL(10, 2) NOT NULL,
  "commissionRate" DECIMAL(5, 4) NOT NULL,
  "commissionAmount" DECIMAL(10, 2) NOT NULL,
  "status" "CommissionStatus" NOT NULL DEFAULT 'DUE',
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commissions_appointmentId_key" ON "commissions"("appointmentId");
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "verification_events" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verification_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "verification_events_appointmentId_idx" ON "verification_events"("appointmentId");
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
