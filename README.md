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
| `package`            | The package whose API to check for semver (in Package Id Specification format, see https://doc.rust-lang.org/cargo/reference/pkgid-spec.html for reference). If not set, all packages in the workspace are processed. | |
| `manifest-path`      | Path to Cargo.toml of crate or workspace to check. By default, the action will assume it exists in the current directory. | |
| `verbose`           | Enables verbose output of `cargo-semver-checks`. | `false` |
| `github-token`       | The `GITHUB_TOKEN` secret used to download precompiled binaries from GitHub API. If not specified, the [automatic GitHub token](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) provided to the workflow will be used. The token may be alternatively passed in an environment variable `GITHUB_TOKEN`. | |

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
