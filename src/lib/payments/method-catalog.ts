export type PaymentMethodCode =
  | "cash"
  | "check"
  | "cash_app_pay"
  | "apple_pay"
  | "google_pay"
  | "venmo"
  | "venmo_tap_to_pay";

export type PaymentMethodDefinition = {
  code: PaymentMethodCode;
  label: string;
  availableForOctoberPilot: boolean;
  defaultEnabled: boolean;
  provider: "manual" | "stripe_connect" | "paypal_venmo" | "venmo_business";
  confirmation: "director" | "webhook" | "provider_or_director";
  setupSummary: string;
};

export const PAYMENT_METHOD_CATALOG: readonly PaymentMethodDefinition[] = [
  { code: "cash", label: "Cash", availableForOctoberPilot: true, defaultEnabled: true, provider: "manual", confirmation: "director", setupSummary: "A director or co-director records cash only after receiving it." },
  { code: "check", label: "Check", availableForOctoberPilot: true, defaultEnabled: true, provider: "manual", confirmation: "director", setupSummary: "A director or co-director records a check only after receiving it." },
  { code: "cash_app_pay", label: "Cash App Pay", availableForOctoberPilot: false, defaultEnabled: false, provider: "stripe_connect", confirmation: "webhook", setupSummary: "Requires an approved connected merchant account, provider fees, settlement account, webhook verification, and live testing." },
  { code: "apple_pay", label: "Apple Pay", availableForOctoberPilot: false, defaultEnabled: false, provider: "stripe_connect", confirmation: "webhook", setupSummary: "Requires an approved connected merchant account, domain verification, provider fees, settlement account, webhook verification, and live testing." },
  { code: "google_pay", label: "Google Pay", availableForOctoberPilot: false, defaultEnabled: false, provider: "stripe_connect", confirmation: "webhook", setupSummary: "Requires an approved connected merchant account, provider fees, settlement account, webhook verification, and live testing." },
  { code: "venmo", label: "Venmo", availableForOctoberPilot: false, defaultEnabled: false, provider: "paypal_venmo", confirmation: "webhook", setupSummary: "Requires an approved PayPal/Venmo merchant integration, provider fees, settlement account, webhook verification, and live testing." },
  { code: "venmo_tap_to_pay", label: "Venmo Tap to Pay", availableForOctoberPilot: false, defaultEnabled: false, provider: "venmo_business", confirmation: "provider_or_director", setupSummary: "Requires an eligible Venmo Business profile, supported device and region, provider fees, settlement account, and live testing." },
] as const;

export function octoberPilotPaymentMethods(accepted: readonly ("cash" | "check")[] = ["cash", "check"]) {
  const enabled = new Set(accepted);
  return PAYMENT_METHOD_CATALOG.filter((method) => method.availableForOctoberPilot && enabled.has(method.code as "cash" | "check"));
}

export function futurePaymentMethods() {
  return PAYMENT_METHOD_CATALOG.filter((method) => !method.availableForOctoberPilot);
}
