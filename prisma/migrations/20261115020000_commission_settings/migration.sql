-- No default rate: an administrator must explicitly configure it.
CREATE TABLE "commission_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "rate" DECIMAL(5, 4) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commission_settings_pkey" PRIMARY KEY ("id")
);
