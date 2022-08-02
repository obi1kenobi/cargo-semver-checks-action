# cargo-semver-checks-action
A GitHub Action for running cargo-semver-checks

By default, this action assumes that:
- Your cargo workspace contains a single crate.
- Your releases are tagged in git as `v{major}.{minor}.{patch}`, for example `v1.2.3`.

Single-crate workspaces can use it as:
```
steps:
- uses: actions/checkout@v3
  with:
    fetch-depth: 0
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v1
- name: Publish to crates.io
  run: # your `cargo publish` code here
```

To use it in a workspace with more than one crate:
- use the `crate-name` setting to specify which crate should be checked in a given run, and
- use the `version-tag-prefix` setting to override the default prefix `v` to match the way the releases of your crate are tagged.

For example, this is publishing `my-crate` whose releases are tagged as `my-crate-v1.2.3`:
```
steps:
- uses: actions/checkout@v3
  with:
    fetch-depth: 0
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v1
  with:
    crate-name: my-crate
    version-tag-prefix: my-crate-v
- name: Publish my-crate to crates.io
  run: # your `cargo publish` code here
```
