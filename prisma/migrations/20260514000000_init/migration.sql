-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "linkedinUrl" TEXT NOT NULL,
    "fullName" TEXT,
    "currentCompany" TEXT,
    "currentDesignation" TEXT,
    "totalYearsExperience" DOUBLE PRECISION,
    "emails" JSONB NOT NULL DEFAULT '[]',
    "phones" JSONB NOT NULL DEFAULT '[]',
    "workHistory" JSONB NOT NULL DEFAULT '[]',
    "confidence" JSONB NOT NULL DEFAULT '{}',
    "sources" JSONB NOT NULL DEFAULT '{}',
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "requestSummary" JSONB NOT NULL DEFAULT '{}',
    "responseSummary" JSONB NOT NULL DEFAULT '{}',
    "fieldsReturned" JSONB NOT NULL DEFAULT '[]',
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL,
    "costPerRequest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerSuccessfulContact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyLimit" DOUBLE PRECISION,
    "monthlyLimit" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_linkedinUrl_key" ON "Lead"("linkedinUrl");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderLog_provider_createdAt_idx" ON "ProviderLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderLog_leadId_idx" ON "ProviderLog"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_provider_key" ON "ProviderConfig"("provider");

-- CreateIndex
CREATE INDEX "ProviderConfig_enabled_priority_idx" ON "ProviderConfig"("enabled", "priority");

-- AddForeignKey
ALTER TABLE "ProviderLog" ADD CONSTRAINT "ProviderLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
