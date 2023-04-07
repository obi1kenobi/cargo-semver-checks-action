The testing workflow is divided into several parts:

 - `test-action.yml`, which contains simple, general integration tests of the action that should be run on each platform

 and the following ones run on `ubuntu-latest`:

 - `test-build.yml` containing source-related checks:
 linters, formatters and verifying whether the sources match `dist/` directory,
 - `test-inputs.yml` containing specific integration
 tests checking whether the action inputs are processed properly,
 - `test-cache.yml` focusing on veryfing whether
 the baseline rustdoc is cached correctly.

`setup-test-workspace` is a helper action that creates a workspace containing two crates: the test fork of `ref_slice` and a dummy crate that has no matching baseline version on `crates.io`.
