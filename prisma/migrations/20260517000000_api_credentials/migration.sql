CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedValue" TEXT,
    "iv" TEXT,
    "authTag" TEXT,
    "keyHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_configured',
    "lastError" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiCredential_provider_key" ON "ApiCredential"("provider");
CREATE INDEX "ApiCredential_status_idx" ON "ApiCredential"("status");
