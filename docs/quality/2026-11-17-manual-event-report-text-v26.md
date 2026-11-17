# V26 manual event PDF text acceptance

Base V25 d59701258a3fdfef324850d015ed22e75b9871da preserved in separate directory.

## Observed problem and scope
Actual valid fictional card with Hawaiian okina/macron passes strict scorecard DTO but existing PDF returns null; actual normal report handler returns503. Reproduced baseline using exact V25 report source with valid fixture: six failures/one denial pass. Original source restored after bounded reproduction.

One product file changes: src/lib/identity-v5/report.ts. Reuse existing safeText policy before BOTH Helvetica measurement and draw. Manual legal-field whitelist remains; raw plus rendered-normalized legal names/city/state reject UUID/Temporary ID namespace. No payouts, MRP arithmetic/awards, identity storage, DTO, routes, SQL, roles, gates or dependencies changed.

## Character fidelity
Downloaded visible page text states: Names and locations use the standard PDF font: accents simplified; unsupported characters shown as ?. Tests extract actual drawn PDF content, not metadata. Ka\u02bbi is rendered Ka'i, macrons simplify; unsupported script is ?. Source card is deep-equal before/after. This is disclosed simplified rendering, NOT exact spelling preservation in output. Existing project policy already uses this fallback; no bundled Unicode font asset found in public/, and no fontkit dependency exists. Full Unicode font embedding remains a separate fidelity enhancement requiring a licensed font and reviewed asset/dependency.

## Local checks
Seven focused groups: valid Hawaiian card/PDF/source immutability; two same-household rows/no private IDs/distinctions/address; raw/normalized namespace-smuggling denial; actual issued ZZ only with no award; actual provider/handler private PDF/read RPCs; session/capability/malformed-denial; multipage long text.

Four browser cases at390/1440: actual existing IdentityWorkflowClientV5 selector/download anchor to actual handler/provider produces two-member PDF with correct fixed fixture amounts/unawarded MRPs/font notice/no IDs; synthetic session loss403/noPDF/no writer. Existing stylesheet, no overflow/JS errors; serviceworkers blocked. Loopback listener closed; temporary fixture PDFs removed. Browser uses synthetic sessions/RPC data, no database/Auth/PostgREST/NextSSR; not hosted acceptance.

Independent reviewer bounded PASS on product/export boundary. Full outcomes in external CHECKS.json. pnpm/audit unavailable and private handoff absent in clean source; do not infer complete release readiness. Unverified gates stayoff; no denied publication retry/email/hosted/session/practice access.

## Final aggregate
Full3794pass0fail; focused7pass0fail including explicit wrong actor/capability cases;4 browser cases pass. Lint0errors252existingwarnings, typecheck/provider pass, production buildpass with fictional localhost:9 config after unchanged Next16.4.2 advisory retry. Existing Next security-upgrade recommendation retained; no upgrade. Workspace7pass1privatehandoffskip after build; initial premature workspace invocation failed missing build manifest and was rerun in required order. pnpm audit/aggregate unavailable; private import absent. No new dependency, font asset or persistent authority.
