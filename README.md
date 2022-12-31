# cargo-semver-checks-action
Lint your crate API changes for semver violations.

By default, this action assumes that:
- Your cargo workspace contains a single crate which contains a library target.
- Your releases are tagged in git as `v{major}.{minor}.{patch}`, for example `v1.2.3`.

Single-crate workspaces can use it as:
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v1
- name: Publish to crates.io
  run: # your `cargo publish` code here
```

# Input options

Every argument is optional.

| Input              | Description                                                                                                                       | Default |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------|---------|
| crate-name         | The crate whose API to check for semver                                                                                           |         |
| crate-target       | By default, check the library target of the crate. To check a different target (e.g. a binary target), set this to `--bin <NAME>` | `--lib` |
| version-tag-prefix | The prefix to use for the git tag for a version; the default "v" creates tags like "v1.0.0"                                       | `v`       |

# Scenarios

- [Use with a different version tag format](#use-with-a-different-version-tag-format)
- [Use in workspaces with more than one crate](#use-in-workspaces-with-more-than-one-crate)
- [Use with binary crates or crates with more than one target](#use-with-binary-crates-or-crates-with-more-than-one-target)

## Use with a different version tag format

Change the `version-tag-prefix` setting to reflect the prefix used to create the version tag. The setting's default value `'v'` creates version tags like `v1.2.3`.

For example, if your versions are tagged as `1.2.3`, you can set `version-tag-prefix` to be the empty string:
```yaml
- name: Check semver
  uses: obi1kenobi/cargo-semver-checks-action@v1
  with:
    version-tag-prefix: ''
- name: Publish my-crate to crates.io
  run: # your `cargo publish` code here
```

## Use in workspaces with more than one crate

You'll need to specify which crate should be checked, and the format used for version tags for that crate:
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

## Use with binary crates or crates with more than one target

To check a different (non-library) target in a crate, use the `crate-target` setting:
```yaml
- name: Check semver for my_binary
  uses: obi1kenobi/cargo-semver-checks-action@v1
  with:
    crate-target: --bin my_binary
- name: Publish my-crate to crates.io
  run: # your `cargo publish` code here
```
