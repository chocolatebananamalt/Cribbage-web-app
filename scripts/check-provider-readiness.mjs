import {
  inspectProviderReadiness,
  parseRequiredCapabilities,
} from "../src/lib/providers/activation-readiness.ts";

const parsedRequirements = parseRequiredCapabilities(process.argv.slice(2));
const requested = parsedRequirements.requested;
const report = inspectProviderReadiness(process.env);
const knownCapabilities = new Set(report.providers.map(({ capability }) => capability));
const unknown = requested.filter((capability) => !knownCapabilities.has(capability));

console.log(`October manual fallbacks: ${report.manualFallbacksDeclared ? "DECLARED" : "MISSING"}`);
for (const provider of report.providers) {
  const state = provider.enabled
    ? "UNRELEASED ENABLEMENT REJECTED"
    : (provider.configurationReady ? "CONFIGURED; FEATURE DISABLED" : "DISABLED; MANUAL FALLBACK DECLARED");
  console.log(`${provider.capability}: ${state}`);
  console.log(`  fallback: ${provider.manualFallback}`);
  if ((provider.enabled || requested.includes(provider.capability)) && provider.missing.length) {
    console.log(`  missing: ${provider.missing.join(", ")}`);
  }
  for (const error of provider.errors) console.log(`  error: ${error}`);
}
for (const error of report.globalErrors) console.log(`error: ${error}`);
for (const error of parsedRequirements.errors) console.log(`error: ${error}`);
for (const capability of unknown) console.log(`error: unknown required capability: ${capability}`);

const invalid = parsedRequirements.errors.length > 0 || unknown.length > 0 || report.globalErrors.length > 0 || report.providers.some((provider) => provider.errors.length > 0);
const unmet = requested.some((capability) => {
  const provider = report.providers.find((candidate) => candidate.capability === capability);
  return !provider || !provider.configurationReady;
});
process.exitCode = invalid || unmet || !report.manualFallbacksDeclared ? 1 : 0;
