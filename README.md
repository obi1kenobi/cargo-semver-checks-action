# cargo-semver-checks-action
Lint your crate API changes for semver violations.

```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
- name: Publish to crates.io
  run: # your `cargo publish` code here
```

* [Basic usage](#basic-usage)
* [Input options](#input-options)
* [Example scenarios](#example-scenarios)
  * [Use outside root directory of a crate or a workspace](#use-outside-root-directory-of-a-crate-or-a-workspace)
  * [Specifying a baseline](#specifying-a-baseline)
  * [Specify crates to be checked](#specify-crates-to-be-checked)
  * [Exclude crates from being checked](#exclude-crates-from-being-checked)
  * [Use toolchain other than `stable`](#use-toolchain-other-than-stable)
  * [Build for target other than default](#build-for-target-other-than-default)
* [Customizing baseline rustdoc caching strategy](#customizing-baseline-rustdoc-caching-strategy)

## Basic usage

The action is designed to be used right before `cargo publish`. It will check the API of your crate for semver violations, comparing it to the latest normal (not pre-release or yanked) version published on crates.io. At the moment, the action does not support checking against other baselines, such as the destination branch of a pull request.

If your repository is just a crate or a workspace, the action will work out-of-the-box with sensible defaults:
```yaml
semver-checks:
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    - name: Check semver
      uses: obi1kenobi/cargo-semver-checks-action@v2
```
> **Note**
> By default, the action always installs the latest stable Rust and ignores the `rust-toolchain.toml` file and any local overrides. This ensures we use the latest version of rustdoc, taking advantage of the latest bugfixes and avoiding false-positives. If you want to change this default behavior, see [Use toolchain other than `stable`](#use-toolchain-other-than-stable).

## Input options

Every argument is optional.

| Input                | Description                                                                                                                       | Default |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------|---------|
| `package`            | Comma-separated list of the packages whose API to check for semver (in Package Id Specification format, see https://doc.rust-lang.org/cargo/reference/pkgid-spec.html for reference). If not set, all packages defined in the Cargo.toml file are processed. | |
| `exclude`            | Comma-separated list of the packages that will be excluded from being processed. Has effect only if the input `package` is not specified. | |
| `manifest-path`      | Path to Cargo.toml of crate or workspace to check. If not specified, the action assumes the manifest is under the default [`GITHUB_WORKSPACE`](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables) path. | |
| `feature-group`      | Which [feature group](https://github.com/obi1kenobi/cargo-semver-checks#what-features-does-cargo-semver-checks-enable-in-the-tested-crates) to enable. When not set, the action heuristically enables all features that are not unstable, nightly, or internal-only. Possible values: `all-features`, `default-features`, `only-explicit-features`. | |
| `features`           | Explicitly enable a list of features when checking. Corresponds to [the tool's `--features` flag](https://github.com/obi1kenobi/cargo-semver-checks#what-features-does-cargo-semver-checks-enable-in-the-tested-crates). | |
| `verbose`            | Enables verbose output of `cargo-semver-checks`. | `false` |
| `release-type`       | Sets the release type instead of deriving it from the version number specified in the `Cargo.toml` file. Possible values are `major`, `minor`, `patch`. | |
| `rust-toolchain`     | Rust toolchain name to use, e.g. `stable`, `nightly` or `1.68.0`. It will be installed if necessary and used regardless of local overrides and the `rust-toolchain.toml` file. However, if the input is set to `manual`, the action assumes some Rust toolchain is already installed and uses the default one. | `stable` |
| `rust-target`        | Rust target to build for, e.g. `x86_64-pc-windows-msvc` or `aarch64-apple-darwin`. It will be installed if necessary and used regardless of the `.cargo/config.toml` file. However, if `rust-toolchain` is set to `manual`, the action assumes the target is already installed. | |
| `shared-key`         | A cache key that will be used instead of the automatic key based on the name of the GitHub job and values of the inputs `package`, `exclude` and `manifest-path`. Might be provided e.g. to share the cache between the jobs. | |
| `prefix-key`         | Additional prefix of the cache key, can be set to start a new cache manually. | |
| `github-token`       | The `GITHUB_TOKEN` secret used to download precompiled binaries from GitHub API. If not specified, the [automatic GitHub token](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) provided to the workflow will be used. The token may be alternatively passed in an environment variable `GITHUB_TOKEN`. | `${{ github.token }}` |
| `baseline-version`   | Version from registry to lookup for a baseline. | |
| `baseline-rev`       | Git revision to lookup for a baseline. | |
| `baseline-root`      | Directory containing baseline crate source. | |

## Example scenarios

### Use outside root directory of a crate or a workspace

The action will work well with defaults settings if it is run inside the package root directory. When the package location is different, you have to specify the path to its `Cargo.toml` file:
```yaml
- name: Check semver for my-crate
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    manifest-path: semver/my-crate/Cargo.toml  # or just semver/my-crate/
```

In the same way you can provide the path to the workspace `Cargo.toml` file, which will result in checking all its crates:
```yaml
- name: Check semver for all crates from my-workspace
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    manifest-path: semver/my-workspace/Cargo.toml  # or just semver/my-workspace/
```

### Specifying a baseline

By default [`cargo-semver-checks`](https://github.com/obi1kenobi/cargo-semver-checks) uses crates.io to look up the previous version of the crate, which is used as
the baseline for semver-checking the current version of the crate. The following inputs can be used to explicitly specify a baseline instead:

Use a version from registry to lookup for a baseline:
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    baseline-version: 4.9.1
```

Use a git revision to lookup for a baseline
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    baseline-revision: b0fd440798ab3cfb05c60a1a1bd2894e1618479e
```

Point to a directory that contains the baseline crate source
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    baseline-root: test_crates/template/old
```

### Specify crates to be checked

By default, all packages defined in the `Cargo.toml` file are processed. You can specify one or more packages to be checked instead using input `package`.

For example, this will check `my-crate-api` and `my-crate-core`:
```yaml
- name: Check semver for my-crate-api and my-crate-core
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    package: my-crate-api, my-crate-core
```

Inputs `package` and `manifest-path` might be used together:
```yaml
- name: Check semver for my-crate from my-workspace
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    manifest-path: semver/my-workspace/Cargo.toml  # or just semver/my-workspace/
    package: my-crate
```

### Exclude crates from being checked

This will process all crates from the current workspace except `my-crate-tests`:
```yaml
- name: Check semver for all crates except my-crate-tests
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    exclude: my-crate-tests
```

### Use toolchain other than `stable`

By default, the action installs (if necessary) and then uses the `stable` toolchain regardless of local overrides and the `rust-toolchain.toml` file. You can force using a different toolchain using `rust-toolchain`:
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    rust-toolchain: nightly
```
If you want to setup the toolchain manually, you can set `rust-toolchain` to `manual`. In this case, the action assumes some Rust toolchain is already installed and uses the default one:
```yaml
- name: Setup Rust
  uses: actions-rust-lang/setup-rust-toolchain@v1
  with:
    toolchain: stable
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    rust-toolchain: manual
```

### Build for target other than default

By default, the action uses the default target based on the host platform. You can force using a different target (which will be installed if missing) using `rust-target`. For example, you can check an `aarch64-apple-darwin` build while using the default Linux-based GitHub Actions runner:
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    rust-target: aarch64-apple-darwin
```
If you want to set up the toolchain manually, you can set `rust-toolchain` to `manual`. In this case, the action will *not* attempt to install the target — instead, it assumes the target is already set up:
```yaml
- name: Setup Rust
  uses: actions-rust-lang/setup-rust-toolchain@v1
  with:
    toolchain: stable
    target: aarch64-apple-darwin
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    rust-toolchain: manual
    rust-target: aarch64-apple-darwin
```

## Customizing baseline rustdoc caching strategy

The action caches the baseline rustdoc for each package in the workspace. The keys used to distinguish the caches consist of four components:

 - `prefix-key` input, which defaults to an empty string,
 - `shared-key` input if provided, otherwise the value of environmental variable `GITHUB_JOB` concatenated with a hash of the values of inputs `package`, `exclude` and `manifest-path` (we hash the path itself, not the file it points to),
 - internal, unchangable component, being a concatenation of the runner OS, `rustc` version, `cargo-semver-checks` version and hash of all `Cargo.lock` files in the current workspace,
 - constant suffix `"semver-checks-rustdoc"`.

Runs that differ in at least one of the above components will use separate caches. Inputs `prefix-key` and `shared-key` might be therefore used to customize the caching strategy. For example, the two following jobs will share the key even despite using different `manifest-path`:
```yaml
semver:
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    - name: Check semver
      uses: obi1kenobi/cargo-semver-checks-action@v2
      with:
        shared-key: my-workspace-semver

semver2:
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
      with:
        path: semver
    - name: Check semver
      uses: obi1kenobi/cargo-semver-checks-action@v2
      with:
        manifest-path: semver/Cargo.toml
        shared-key: my-workspace-semver
```
which is reasonable until they are checking the same packages. Runs with different targets must not share the cache! For example, the below job is doing well with default settings:
```yaml
semver:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      crate: ['api', 'core']
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    - name: Check semver
      uses: obi1kenobi/cargo-semver-checks-action@v2
      with:
        package: ${{ matrix.crate }}
        # Do not do this!
        # shared-key: 'my-workspace-semver'
```
as both runs will use separate caches, but providing the shared key will lead to data race and significant drop of performance. On the other hand, if you want to further separate the caches that are shared by default, you can use the input `prefix-key`:
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    prefix-key: v1
```
