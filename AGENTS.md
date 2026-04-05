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

## Release tags

The repository's git tags are the source of truth for released versions. Current tag history reviewed on 2026-04-05:

- Major-only tags: `v1`, `v2`, etc.
- Full release tags: for example `v1.0`, `v1.4`, `v2.0`, `v2.8`, etc.
- Existing release tags are lightweight tags rather than annotated tags

Release policy:

- Treat `v<major>` tags as movable aliases that point to the latest release in that major series.
- Treat `v<major>.<minor>` tags as permanent release tags. Do not retarget them after publishing.
- Keep `package.json` and `package-lock.json` aligned with the latest full release tag using a `.0` patch component, so `v2.8` corresponds to package version `2.8.0`.
- Release in two stages:
  - `scripts/create-minor-release-pr.sh` must be run from a clean `main` checkout. It creates a dedicated release branch, bumps `package.json` and `package-lock.json`, pushes the branch, opens a PR to `main`, and enables squash auto-merge.
  - `scripts/tag-minor-release.sh` must be run from a clean `main` checkout after the version-bump PR has merged. It reads the committed `package.json` version, creates the new `v<major>.<minor>` tag, moves the `v<major>` tag, and pushes both tags to `origin`.
  - `scripts/cut-minor-release.sh` is the convenience wrapper that runs the PR script, waits for the version bump to appear on `main`, and then runs the tag script.

## Scripts

- `npm run build`: bundle `src/main.ts` into `dist/`
- `npm run format`
- `npm run format-check`
- `npm run lint`
- `npm test`
- `npm run all`: format, lint, build, then test
- `scripts/create-minor-release-pr.sh`: create the version-bump release branch and PR, then enable squash auto-merge
- `scripts/tag-minor-release.sh`: publish the minor release tags from the merged `main` commit
- `scripts/cut-minor-release.sh`: convenience wrapper that waits for the merged version bump and then publishes tags

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
