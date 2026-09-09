# Vercel framework-preset verification

## Finding

The review project built successfully by automatic detection, but its Vercel
project record reported `framework: null`. That leaves a future deployment
dependent on heuristic detection rather than an explicit project contract.

## Repair and evidence

On 2026-09-09, the project’s Build and Deployment settings were set to
**Next.js** with no custom build, output, install, or development command.
The root directory remains blank and the Node.js runtime remains the tested
`24.x`.

Vercel’s connected project record subsequently reports:

```text
project: cribbage-web-app
framework: nextjs
nodeVersion: 24.x
live: false
```

The project intentionally remains an unreleased preview/pilot. This confirms
only hosting configuration; it does not certify application behavior,
production domains, monitoring, backups, or tournament workflows.
