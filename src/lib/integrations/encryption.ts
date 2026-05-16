import "server-only";

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("API_KEY_ENCRYPTION_SECRET or NEXTAUTH_SECRET must be configured before saving API keys.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(input: { encryptedValue?: string | null; iv?: string | null; authTag?: string | null }) {
  if (!input.encryptedValue || !input.iv || !input.authTag) {
    return null;
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));

  return Buffer.concat([decipher.update(Buffer.from(input.encryptedValue, "base64")), decipher.final()]).toString("utf8");
}

export function secretHint(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(-4);
}
