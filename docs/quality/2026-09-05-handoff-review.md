# Handoff verification — September 5, 2026

Scope: recover and organize supplied artifacts, establish project guidance and executable baseline checks. Not production implementation or certification.

## Executed evidence

- Windows PowerShell; bundled Node runtime. Command: `node --test tests/workspace.test.mjs` using the absolute executable below.
- Workspace suite: 3 passed; nested handoff suite: 6 passed, zero failures or skips. Checks cover guidance, expected folders, private-source Git exclusions, all 32 manifest hashes/sizes and organized copies, seven demo role render functions, three score boundary examples and section-isolated notes.
- Both nested prototype ZIPs contain HTML byte-identical to their corresponding outer HTML files.
- python-docx inspection: v1.0 has 197 paragraphs/11 tables; v1.1 has 262 paragraphs/16 tables. Every nonempty paragraph and table cell occurs in the supplied extracted text (whitespace normalized). Both extracted specifications were reviewed.
- pypdf extracted all 16 PDF pages; reviewed baseline plus additions through section 43. The v1.1 PDF retains a v1.0 baseline cover, with v1.1 additions explicitly appended; this is not a different requirements baseline.
- All 15 unique reference images reviewed visually. Three exact duplicate pairs map to shared organized copies. Original files and archive preserved.

Local verification command:

```powershell
& 'C:\Users\choco\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/workspace.test.mjs
```

## Limits and outstanding gates

Demo rendering checks use a simulated DOM, not real browser automation. No phone/desktop browser acceptance, real backend, multi-user concurrency, production build, ACC rules certification, backup restore or live pilot was verified. No prototype UI was changed. Read docs/recovery/REVIEW.md for launch-blocking defects.

The GitHub workflow was created locally, not pushed or run remotely. Required-check branch protection is not configured. In a clone without private handoff files, the general suite explicitly skips the handoff suite; the dedicated handoff command fails if those files are missing. Private sources are excluded from Git, not encrypted; maintain a separate secure backup.

## Model-routing policy check

Added `docs/operations/MODEL_ROUTING.md` and linked it from both project entry instructions. Revised it at the owner's direction to prohibit GPT-6 Astra, use Terra as lead, reserve Sol for focused plan/high-risk review, and use Luna/Mini for economical execution. Assertions cover the prohibition, Sol review tier, independent review, and the rule that model strength cannot replace evidence. Re-ran `node --test tests/workspace.test.mjs`: 3 workspace tests passed; its nested handoff run passed 6 tests; zero failures and zero skips. `git diff --check` completed without whitespace errors (Git emitted informational LF-to-CRLF working-tree warnings).
