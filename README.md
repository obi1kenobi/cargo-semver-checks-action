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

# Scenarios

- [Use in workspaces with more than one crate](#use-in-workspaces-with-more-than-one-crate)

## Use in workspaces with more than one crate

By default, if workspace contains multiple crates, all of them are checked against semver violations. You can specify single crate to be checked instead, along with the format used for version tags for that crate:
- `crate-name` specifies the crate to check, and
- `version-tag-prefix` sets the text prepended to the version number to create the git tag for that release.

For example, this will check `my-crate` whose releases are tagged as `my-crate-v1.2.3`:
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v1
  with:
    crate-name: my-crate
    version-tag-prefix: my-crate-v
- name: Publish my-crate to crates.io
  run: # your `cargo publish` code here
```
