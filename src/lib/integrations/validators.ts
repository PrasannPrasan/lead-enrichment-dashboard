import "server-only";

import type { ManagedIntegrationProvider } from "@/lib/integrations/definitions";

type ValidationResult = {
  valid: boolean;
  error: string | null;
};

async function parseResponseSummary(response: Response) {
  const text = await response.text();

  if (!text) {
    return "";
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const message =
        record.error ||
        record.message ||
        record.error_message ||
        (typeof record.errors === "string" ? record.errors : undefined);

      if (typeof message === "string") {
        return message;
      }
    }

    return JSON.stringify(parsed).slice(0, 240);
  } catch {
    return text.slice(0, 240);
  }
}

async function requestValidation(url: string, init: RequestInit, timeoutMs = 12000): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (response.ok) {
      return {
        valid: true,
        error: null,
      };
    }

    const summary = await parseResponseSummary(response);

    return {
      valid: false,
      error: summary ? `HTTP ${response.status}: ${summary}` : `HTTP ${response.status}: API key validation failed`,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "API key validation request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function validatePdlKey(apiKey: string): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://api.peopledatalabs.com/v5/person/enrich", {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
    });

    if (response.ok || response.status === 400) {
      return {
        valid: true,
        error: null,
      };
    }

    const summary = await parseResponseSummary(response);

    return {
      valid: false,
      error: summary ? `HTTP ${response.status}: ${summary}` : `HTTP ${response.status}: API key validation failed`,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "People Data Labs key validation request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateIntegrationKey(provider: ManagedIntegrationProvider, apiKey: string): Promise<ValidationResult> {
  switch (provider) {
    case "apollo":
      return requestValidation("https://api.apollo.io/v1/auth/health", {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
      });

    case "hunter": {
      const params = new URLSearchParams({
        api_key: apiKey,
      });

      return requestValidation(`https://api.hunter.io/v2/account?${params.toString()}`, {});
    }

    case "ninjapear":
      return requestValidation("https://nubela.co/api/v1/meta/credit-balance", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

    case "pdl":
      return validatePdlKey(apiKey);
  }
}
