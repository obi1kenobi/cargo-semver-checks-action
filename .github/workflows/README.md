The testing workflow is divided into three parts:
 - `test-build.yml` is run on `ubuntu-latest` and contains source-related checks:
 linters, formatters and verifying whether the sources match dist/ directory.
 - `test-action.yml` contains simple, general integration tests of the action
 that should be run on each platform.
 - `test-inputs.yml` is run on `ubuntu-latest` and contains specific integration
 tests checking whether the action inputs are processed properly.

`setup-test-workspace` is a helper action that creates a workspace containing two crates: the test fork of `ref_slice` and a dummy crate that has no matching baseline version on `crates.io`.
