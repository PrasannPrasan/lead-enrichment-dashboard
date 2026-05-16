import "server-only";

import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, secretHint } from "@/lib/integrations/encryption";
import { API_INTEGRATIONS, getEnvKeyForProvider, getIntegrationDefinition, type ManagedIntegrationProvider } from "@/lib/integrations/definitions";
import { validateIntegrationKey } from "@/lib/integrations/validators";

export type IntegrationStatus = "connected" | "invalid" | "not_configured";

export type SerializedIntegration = {
  provider: ManagedIntegrationProvider;
  label: string;
  description: string;
  envNames: string[];
  status: IntegrationStatus;
  source: "database" | "environment" | "none";
  keyHint: string | null;
  lastError: string | null;
  lastValidatedAt: string | null;
  fallbackAvailable: boolean;
};

function serializeStatus(credential: Awaited<ReturnType<typeof prisma.apiCredential.findUnique>>, provider: ManagedIntegrationProvider): SerializedIntegration {
  const definition = getIntegrationDefinition(provider);
  const envKey = getEnvKeyForProvider(provider);

  if (!definition) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }

  if (credential) {
    return {
      provider,
      label: definition.label,
      description: definition.description,
      envNames: definition.envNames,
      status: credential.status === "connected" ? "connected" : credential.status === "invalid" ? "invalid" : "not_configured",
      source: credential.encryptedValue ? "database" : envKey ? "environment" : "none",
      keyHint: credential.keyHint,
      lastError: credential.lastError,
      lastValidatedAt: credential.lastValidatedAt?.toISOString() ?? null,
      fallbackAvailable: Boolean(envKey),
    };
  }

  if (envKey) {
    return {
      provider,
      label: definition.label,
      description: definition.description,
      envNames: definition.envNames,
      status: "connected",
      source: "environment",
      keyHint: envKey.envName,
      lastError: null,
      lastValidatedAt: null,
      fallbackAvailable: false,
    };
  }

  return {
    provider,
    label: definition.label,
    description: definition.description,
    envNames: definition.envNames,
    status: "not_configured",
    source: "none",
    keyHint: null,
    lastError: null,
    lastValidatedAt: null,
    fallbackAvailable: false,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

export async function listIntegrationStatuses() {
  const credentials = await withTimeout(
    prisma.apiCredential.findMany(),
    3500,
    "Encrypted API key storage timed out. The app will keep using environment variable fallbacks.",
  );
  const byProvider = new Map(credentials.map((credential) => [credential.provider, credential]));

  return API_INTEGRATIONS.map((definition) => serializeStatus(byProvider.get(definition.provider) ?? null, definition.provider));
}

export function listEnvIntegrationStatuses() {
  return API_INTEGRATIONS.map((definition) => serializeStatus(null, definition.provider));
}

export async function getProviderApiKey(provider: ManagedIntegrationProvider) {
  let credential: Awaited<ReturnType<typeof prisma.apiCredential.findUnique>> = null;

  try {
    credential = await withTimeout(
      prisma.apiCredential.findUnique({
        where: { provider },
      }),
      2500,
      "Encrypted API key storage timed out.",
    );
  } catch {
    return getEnvKeyForProvider(provider)?.value ?? null;
  }

  if (credential?.status === "connected") {
    try {
      const value = decryptSecret(credential);

      if (value) {
        return value;
      }
    } catch {
      // Fall back to env configuration below if an old saved value cannot be decrypted.
    }
  }

  return getEnvKeyForProvider(provider)?.value ?? null;
}

export async function saveIntegrationKey(provider: ManagedIntegrationProvider, rawKey: string) {
  const definition = getIntegrationDefinition(provider);
  const apiKey = rawKey.trim();

  if (!definition) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }

  if (!apiKey) {
    throw new Error("API key is required.");
  }

  const validation = await validateIntegrationKey(provider, apiKey);
  const now = new Date();

  if (!validation.valid) {
    const credential = await prisma.apiCredential.upsert({
      where: { provider },
      create: {
        provider,
        status: "invalid",
        lastError: validation.error,
        lastValidatedAt: now,
      },
      update: {
        encryptedValue: null,
        iv: null,
        authTag: null,
        keyHint: null,
        status: "invalid",
        lastError: validation.error,
        lastValidatedAt: now,
      },
    });

    return serializeStatus(credential, provider);
  }

  const encrypted = encryptSecret(apiKey);
  const credential = await prisma.apiCredential.upsert({
    where: { provider },
    create: {
      provider,
      ...encrypted,
      keyHint: secretHint(apiKey),
      status: "connected",
      lastError: null,
      lastValidatedAt: now,
    },
    update: {
      ...encrypted,
      keyHint: secretHint(apiKey),
      status: "connected",
      lastError: null,
      lastValidatedAt: now,
    },
  });

  await prisma.providerConfig.updateMany({
    where: { provider },
    data: { enabled: true },
  });

  return serializeStatus(credential, provider);
}

export async function removeIntegrationKey(provider: ManagedIntegrationProvider) {
  await prisma.apiCredential.deleteMany({
    where: { provider },
  });

  if (!getEnvKeyForProvider(provider)) {
    await prisma.providerConfig.updateMany({
      where: { provider },
      data: { enabled: false },
    });
  }

  return serializeStatus(null, provider);
}
