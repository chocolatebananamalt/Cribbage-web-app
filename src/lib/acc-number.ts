export const ACC_NUMBER_PATTERN = /^[A-Z]{2}\d+Y?$/;
export const ACC_NUMBER_INPUT_PATTERN = "[A-Z]{2}[0-9]+Y?";

/** Formats a form value without accepting an invalid ACC number. */
export function normalizeAccNumberInput(value: string) {
  return value.toUpperCase().replace(/\s/g, "").replace(/[^A-Z0-9]/g, "");
}

export function isAccNumber(value: string) {
  return ACC_NUMBER_PATTERN.test(value);
}

export function isOptionalAccNumber(value: string) {
  return value === "" || isAccNumber(value);
}

/** The youth suffix is display/audit information, not a different ACC identity. */
export function accIdentityKey(value: string) {
  const normalized = normalizeAccNumberInput(value);
  return isAccNumber(normalized) ? normalized.replace(/Y$/, "") : "";
}
