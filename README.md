# cargo-semver-checks-action
Lint your crate API changes for semver violations.

*This is the work-in-progress v2 version of this action. Find the docs for the stable v1 action [here](https://github.com/obi1kenobi/cargo-semver-checks-action/tree/v1.4).*

```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
- name: Publish to crates.io
  run: # your `cargo publish` code here
```

# Input options

Every argument is optional.

| Input              | Description                                                                                                                       | Default |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------|---------|
| `package`            | The package whose API to check for semver (in Package Id Specification format, see https://doc.rust-lang.org/cargo/reference/pkgid-spec.html for reference). If not set, all packages defined in the Cargo.toml file are processed. | |
| `manifest-path`      | Path to Cargo.toml of crate or workspace to check. If not specified, the action assumes the manifest is under the default [`GITHUB_WORKSPACE`](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables) path. | |
| `verbose`            | Enables verbose output of `cargo-semver-checks`. | `false` |
| `cache-key`          | Rustdoc baseline is cached separately for runs that differ in at least one of the following: runner OS, `rustc` version, `cargo-semver-checks` version, or any of the `Cargo.lock` files in the current workspace. This input might be used to further separate the caches by providing the unique key (by default the job name) for each of them. | `${{ github.job }}` |
| `prefix-key`         | Additional prefix of the cache key, can be set to start a new cache manually. | |
| `github-token`       | The `GITHUB_TOKEN` secret used to download precompiled binaries from GitHub API. If not specified, the [automatic GitHub token](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) provided to the workflow will be used. The token may be alternatively passed in an environment variable `GITHUB_TOKEN`. | `${{ github.token }}` |

# Use in workspaces with a single crate

The action will work out-of-the-box if it is run inside the package root directory. When the package location is different, you have to specify the path to its `Cargo.toml` file:
```yaml
- name: Check semver for my-crate
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    manifest-path: semver/my-crate/Cargo.toml  # or just semver/my-crate/
- name: Publish my-crate to crates.io
  run: # your `cargo publish` code here
```

# Use in workspaces with more than one crate

By default, if workspace contains multiple crates, all of them are checked for semver violations. You can specify a single crate to be checked instead using `package` or `manifest-path`.

For example, this will check `my-crate`:
```yaml
- name: Check semver for my-crate from the current workspace
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    package: my-crate
- name: Publish my-crate to crates.io
  run: # your `cargo publish` code here
```

If the action is not run inside the workspace root directory, you again have to specify the path to its `Cargo.toml` file:
```yaml
- name: Check semver for all crates from my-workspace
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    manifest-path: semver/my-workspace/Cargo.toml  # or just semver/my-workspace/
- name: Publish my-workspace to crates.io
  run: # your `cargo publish` code here
```

The two above might be also used together:
```yaml
- name: Check semver for my-crate from my-workspace
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    manifest-path: semver/my-workspace/Cargo.toml  # or just semver/my-workspace/
    package: my-crate
- name: Publish my-crate to crates.io
  run: # your `cargo publish` code here
```
