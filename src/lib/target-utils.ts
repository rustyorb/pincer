import type { TargetConfig } from "@/lib/types";

/**
 * Extract API key fields from a target for use in API request bodies.
 * Returns apiKeyId if available (secure path), falls back to apiKey (legacy).
 */
export function getTargetKeyFields(target: TargetConfig): {
  apiKeyId?: string;
  apiKey?: string;
} {
  if (target.apiKeyId) {
    return { apiKeyId: target.apiKeyId };
  }
  if (target.apiKey) {
    return { apiKey: target.apiKey };
  }
  return {};
}

/**
 * Check if a target has a usable API key (either vault-stored or legacy).
 */
export function targetHasKey(target: TargetConfig): boolean {
  return !!(target.apiKeyId || target.apiKey);
}

/**
 * Get display label for a target's API key.
 */
export function getKeyDisplayLabel(target: TargetConfig): string {
  if (target.apiKeyLabel) return target.apiKeyLabel;
  if (target.apiKey) {
    const k = target.apiKey;
    if (k.length <= 8) return "••••••••";
    return `${k.slice(0, 4)}...${k.slice(-4)}`;
  }
  return "No key";
}
