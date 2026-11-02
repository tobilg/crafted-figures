# Crafted Figures ownership

Implement against docs/spec.md. Use Node 22-compatible ES modules and JSDoc. Biome owns formatting and linting: `npm run lint` must pass, and `npm run test:types` type-checks the kit's JSDoc. Never reformat `tests/fixtures/regressions`; its bytes are hash-bound evidence.
Do not add publishing, galleries, session-log collection or account integrations.

The stable skill source is skill/crafted-figures/; npm run package:skill generates its ignored runtime/types/recipe copies and assembles the installable dist/crafted-figures/ plus a versioned ZIP. Commit source and lockfiles, not generated runtime, declarations, copied recipes or release artifacts. A raw source-folder copy requires a build. Tests, examples and research belong outside it. Keep model, styling, and rendering separate; preserve deterministic standalone outputs and third-party notices. Pass the release suite and review the figures visually before changing the default authoring pipeline. Record executed evidence and limitations in docs/implementation-status.md. Preserve existing user work; do not publish, push, or install globally.
