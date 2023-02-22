# cargo-semver-checks-action
Lint your crate API changes for semver violations.

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
| package        | The package whose API to check for semver (in Package Id Specification format, see https://doc.rust-lang.org/cargo/reference/pkgid-spec.html for reference). If not set, all packages in the workspace are processed. | |
| manifest-path      | Path to Cargo.toml of crate or workspace to check. Has an effect only if `package` is not specified. | |
| verbose            | Enables verbose output of `cargo-semver-checks`. | `false` |

# Scenarios

- [Use in workspaces with more than one crate](#use-in-workspaces-with-more-than-one-crate)

## Use in workspaces with more than one crate

By default, if workspace contains multiple crates, all of them are checked for semver violations. You can specify a single crate to be checked instead using `package` or `manifest-path`.

For example, this will check `my-crate`:
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v2
  with:
    package: my-crate
- name: Publish my-crate to crates.io
  run: # your `cargo publish` code here
```
