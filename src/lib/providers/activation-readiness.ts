export type ProviderCapability = "online_payments" | "sms_seating" | "paper_card_ocr";

type ProviderDefinition = {
  capability: ProviderCapability;
  flag: string;
  expectedProvider: string | null;
  providerKey: string | null;
  required: readonly string[];
  manualFallback: string;
};

export type ProviderReadiness = {
  capability: ProviderCapability;
  enabled: boolean;
  configurationReady: boolean;
  activationReady: false;
  provider: string | null;
  missing: string[];
  errors: string[];
  manualFallback: string;
  runtimeVerificationRequired: true;
};

const definitions: readonly ProviderDefinition[] = [
  {
    capability: "online_payments",
    flag: "ACC_ONLINE_PAYMENTS_ENABLED",
    expectedProvider: "stripe",
    providerKey: "ACC_PAYMENT_PROVIDER",
    required: [
      "ACC_PAYMENT_PROVIDER",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "ACC_PAYMENT_POLICY_REF",
      "ACC_STRIPE_ADAPTER_VERSION",
      "ACC_STRIPE_TEST_EVIDENCE_REF",
    ],
    manualFallback: "Audited cash/check payment evidence and immutable void history",
  },
  {
    capability: "sms_seating",
    flag: "ACC_SMS_SEATING_ENABLED",
    expectedProvider: null,
    providerKey: "ACC_SMS_PROVIDER",
    required: [
      "ACC_SMS_PROVIDER",
      "SMS_PROVIDER_API_KEY",
      "SMS_SENDER_ID",
      "ACC_SMS_CONSENT_POLICY_REF",
      "ACC_SMS_ADAPTER_VERSION",
      "ACC_SMS_TEST_EVIDENCE_REF",
    ],
    manualFallback: "Searchable and printable initial Seating Assignments list",
  },
  {
    capability: "paper_card_ocr",
    flag: "ACC_PAPER_CARD_OCR_ENABLED",
    expectedProvider: "openai",
    providerKey: "ACC_OCR_PROVIDER",
    required: [
      "ACC_OCR_PROVIDER",
      "ACC_OCR_EXECUTION_MODE",
      "SUPABASE_PAPER_CARD_BUCKET",
      "ACC_PAPER_CARD_RETENTION_POLICY_REF",
      "ACC_OCR_ADAPTER_VERSION",
      "ACC_OCR_TEST_EVIDENCE_REF",
    ],
    manualFallback: "On-device photo aid plus two-official human paper-card transcription",
  },
] as const;

const allowedPublicKeys = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]);
const secretLike = /(SECRET|TOKEN|PRIVATE|SERVICE_ROLE|API_KEY|CREDENTIAL|WEBHOOK|SIGNING)/;
const knownPrivateValue = /^(?:(?:sk|rk)_(?:test|live)_|whsec_|sb_secret_|bearer\s)/i;
const serverOnlyCredentialKeys = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SMS_PROVIDER_API_KEY",
  "OCR_PROVIDER_API_KEY",
] as const;

function value(env: Record<string, string | undefined>, key: string) {
  const candidate = env[key]?.trim();
  return candidate ? candidate : null;
}

function publicSecretErrors(env: Record<string, string | undefined>) {
  const serverOnlyValues = new Set(serverOnlyCredentialKeys
    .map((key) => value(env, key))
    .filter((candidate): candidate is string => candidate !== null));
  return Object.keys(env)
    .filter((key) => {
      if (!key.startsWith("NEXT_PUBLIC_")) return false;
      const candidate = value(env, key);
      return (!allowedPublicKeys.has(key) && secretLike.test(key))
        || (candidate !== null && knownPrivateValue.test(candidate))
        || (candidate !== null && serverOnlyValues.has(candidate));
    })
    .map((key) => `${key} must not be exposed to the browser`)
    .sort();
}

export function parseRequiredCapabilities(args: readonly string[]) {
  const requested: string[] = [];
  const errors: string[] = [];
  for (const argument of args) {
    if (!argument.startsWith("--require")) continue;
    if (!argument.startsWith("--require=") || argument === "--require=") {
      errors.push(`invalid provider requirement: ${argument}`);
      continue;
    }
    const entries = argument.slice("--require=".length).split(",");
    if (entries.some((entry) => entry.trim().length === 0)) {
      errors.push(`invalid provider requirement: ${argument}`);
      continue;
    }
    requested.push(...entries.map((entry) => entry.trim()));
  }
  return { requested: [...new Set(requested)], errors };
}

export function inspectProviderReadiness(
  env: Record<string, string | undefined> = process.env,
) {
  const globalErrors = publicSecretErrors(env);
  const providers: ProviderReadiness[] = definitions.map((definition) => {
    const flagValue = value(env, definition.flag) ?? "disabled";
    const errors: string[] = [];
    if (flagValue !== "enabled" && flagValue !== "disabled") {
      errors.push(`${definition.flag} must be enabled or disabled`);
    }
    const enabled = flagValue === "enabled";
    const provider = definition.providerKey ? value(env, definition.providerKey) : null;
    if (provider && definition.expectedProvider && provider !== definition.expectedProvider) {
      errors.push(`${definition.providerKey} must be ${definition.expectedProvider}`);
    }
    if (definition.capability === "paper_card_ocr" && provider && env.ACC_PAPER_CARD_CAPTURE_ENABLED !== "enabled") {
      errors.push("ACC_PAPER_CARD_CAPTURE_ENABLED must be enabled before OCR");
    }
    if (definition.capability === "paper_card_ocr") {
      const executionMode = value(env, "ACC_OCR_EXECUTION_MODE");
      if (executionMode && executionMode !== "external" && executionMode !== "on_device") {
        errors.push("ACC_OCR_EXECUTION_MODE must be external or on_device");
      }
    }
    if (enabled) {
      errors.push(`${definition.flag} cannot be enabled until its adapter and live activation probe are released`);
    }
    const missing = definition.required.filter((key) => value(env, key) === null);
    if (
      definition.capability === "paper_card_ocr"
      && value(env, "ACC_OCR_EXECUTION_MODE") === "external"
      && value(env, "OCR_PROVIDER_API_KEY") === null
    ) {
      missing.push("OCR_PROVIDER_API_KEY");
    }
    const providerErrors = errors.filter((error) => !error.startsWith(`${definition.flag} cannot be enabled`));
    return {
      capability: definition.capability,
      enabled,
      configurationReady: missing.length === 0 && providerErrors.length === 0 && globalErrors.length === 0,
      activationReady: false,
      provider,
      missing,
      errors,
      manualFallback: definition.manualFallback,
      runtimeVerificationRequired: true,
    };
  });

  return {
    manualFallbacksDeclared: providers.every((provider) => provider.manualFallback.length > 0),
    safeToRunWithProvidersDisabled: globalErrors.length === 0 && providers.every((provider) => (
      !provider.enabled && provider.errors.length === 0
    )),
    globalErrors,
    providers,
  };
}
