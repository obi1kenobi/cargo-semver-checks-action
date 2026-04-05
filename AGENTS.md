## Purpose

This repository contains a JavaScript GitHub Action that runs `cargo semver-checks` for Rust crates/workspaces. The entrypoint in `dist/index.js`.

## High-level layout

- `src/main.ts`: action entrypoint; parses inputs, installs/selects Rust, installs `cargo-semver-checks`, restores/saves rustdoc cache, and runs `cargo-semver-checks`.
- `src/rustdoc-cache.ts`: rustdoc cache key construction and GitHub Actions cache restore/save logic.
- `src/utils.ts`: small helpers for CLI args, hashing, target detection, and version probing.
- `__tests__/utils.test.ts`: only local unit test; most validation lives in GitHub Actions workflows.
- `action.yml`: public action interface and defaults.
- `dist/`: generated bundle checked into git; rebuild and commit it whenever source changes.
- `.github/workflows/`: reusable CI workflows plus a composite helper action for integration-test workspace setup.

## Runtime behavior and important assumptions

- The action installs and uses the requested Rust toolchain unless `rust-toolchain=manual`; default is `stable`.
- The action forces `CARGO_TARGET_DIR=semver-checks/target` so workspace vs. single-crate runs behave consistently.
- If `cargo-semver-checks` is not already available, the action first tries to download a precompiled binary from the latest `obi1kenobi/cargo-semver-checks` GitHub release, then falls back to `cargo install cargo-semver-checks --locked`.
- Rustdoc caching is central behavior. The cache key is built from:
  - `prefix-key`
  - `shared-key`, or else `GITHUB_JOB` plus a hash of `package`, `exclude`, and `manifest-path`
  - runner OS
  - `rustc` version
  - `cargo-semver-checks` version
  - hash of all `Cargo.lock` files under the resolved workspace root
- Baseline selection is forwarded via `--baseline-version`, `--baseline-rev`, and `--baseline-root`.

## Engineering practices

- Language/tooling: TypeScript, CommonJS, ES2022, `strict: true`.
- Formatting/linting: Prettier with 4-space indentation and 100-column width; ESLint with `eslint:recommended`, `@typescript-eslint/recommended`, and mandatory curly braces.
- Generated artifacts are committed. `dist/index.js` and `dist/licenses.txt` come from `npm run build` via `@vercel/ncc`.
- Contributor setup requires GitHub Packages auth for the `@actions-rs` scope; see `CONTRIBUTING.md`.

## Scripts

- `npm run build`: bundle `src/main.ts` into `dist/`
- `npm run format`
- `npm run format-check`
- `npm run lint`
- `npm test`
- `npm run all`: format, lint, build, then test

## CI and test strategy

CI is workflow-heavy and provides most of the confidence:

- `.github/workflows/test-build.yml`: installs dependencies, runs `npm run all`, and fails if rebuilt `src/` or `dist/` differ from committed contents.
- `.github/workflows/test-action.yml`: smoke tests on `ubuntu`, `windows`, and `macos`, across `stable` and `beta`, with `nightly` marked experimental.
- `.github/workflows/test-inputs.yml`: exercises input handling, manifest-path behavior, feature-group options, and expected failure cases.
- `.github/workflows/test-cache.yml`: verifies rustdoc cache save/restore semantics and cache key behavior.
- `.github/workflows/ci.yml`: aggregates the above reusable workflows into the required CI status.

Integration tests use external repositories:

- `mgr0dzicki/cargo-semver-action-ref-slice` for baseline pass/fail scenarios.
- `oxigraph/rio` for multi-package and feature-related checks.

## Change guidance

- When adding or changing an action input, update all of:
  - `action.yml`
  - `src/main.ts` (`getCheckReleaseArguments()`)
  - `.github/workflows/test-inputs.yml`
  - `README.md`
  - `dist/index.js` via rebuild
- If TypeScript source changes, rebuild `dist/` and commit the generated output.
- Prefer preserving the current workflow-centric validation approach; most behavior is tested through GitHub Actions rather than local unit tests.
