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
| crate-name         | The crate whose API to check for semver. If not set, all crates in the workspace are processed. | |
| manifest-path      | Path to Cargo.toml of crate or workspace to check. Has an effect only if `crate-name` is not specified. | |
| verbose            | Enables verbose output of `cargo-semver-checks`. | `false` |

# Scenarios

- [Use in workspaces with more than one crate](#use-in-workspaces-with-more-than-one-crate)

## Use in workspaces with more than one crate

By default, if workspace contains multiple crates, all of them are checked against semver violations. You can specify single crate to be checked instead using `crate-name` or `manifest-path`.

For example, this will check `my-crate`:
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v1
  with:
    crate-name: my-crate
- name: Publish my-crate to crates.io
  run: # your `cargo publish` code here
```
