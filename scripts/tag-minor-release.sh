#!/usr/bin/env bash

# Treat any unexpected failure as release-blocking so we do not publish half-finished tag state.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/tag-minor-release.sh

Publishes the git tags for the minor release that is already merged on `main`.

- Requires a clean `main` checkout
- Reads the current version from `package.json`
- Verifies that version is the next minor release after the latest full tag
- Ensures the permanent `v<major>.<minor>` tag exists on `origin`
- Creates or updates the latest GitHub Release with generated notes from the previous full tag
- Moves the matching movable `v<major>` tag on `origin`
EOF
}

fatal_error() {
  echo "error: $*" >&2
  exit 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# This helper has a single opinionated flow; extra arguments usually mean the caller is using it wrong.
if [[ $# -ne 0 ]]; then
  usage >&2
  exit 1
fi

# Tags are cut from the merged main commit, not from a feature branch or a local-only main variant.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fatal_error "run this script from inside a git repository"
[[ "$(git branch --show-current)" == "main" ]] || fatal_error "run this script from the 'main' branch"
[[ -f package.json ]] || fatal_error "package.json was not found"
command -v node >/dev/null 2>&1 || fatal_error "node is required to read package.json"
command -v gh >/dev/null 2>&1 || fatal_error "gh is required to create the GitHub Release"
gh auth status >/dev/null 2>&1 || fatal_error "gh must be authenticated before creating the GitHub Release"

if [[ -n "$(git status --porcelain)" ]]; then
  fatal_error "working tree is not clean; commit, stash, or remove changes before tagging a release"
fi

git remote get-url origin >/dev/null 2>&1 || fatal_error "remote 'origin' does not exist"

# Refresh remote main first so we can confirm the checked-out commit is the one that actually landed upstream.
echo "Refreshing main from origin..."
git fetch origin main
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || fatal_error "local 'main' is not at origin/main; pull the latest main commit before tagging"

# We force tag updates because this repo intentionally uses movable major tags like v1 and v2.
# Without force, a stale local alias can block fetch from updating to the remote's current target.
echo "Fetching tags from origin..."
git fetch origin --tags --force

package_version="$(node -p "require('./package.json').version")"

if [[ ! "$package_version" =~ ^([0-9]+)\.([0-9]+)\.0$ ]]; then
  fatal_error "package.json version '$package_version' does not match the expected <major>.<minor>.0 format"
fi

package_major="${BASH_REMATCH[1]}"
package_minor="${BASH_REMATCH[2]}"
new_full_tag="v${package_major}.${package_minor}"
major_tag="v${package_major}"
target_commit="$(git rev-parse HEAD)"

# Exclude the release being published so reruns after tag creation still validate against
# the previous permanent release tag and generate notes from that same boundary.
latest_full_tag="$(
  git tag --list "v*.*" --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+$' | grep -vFx "${new_full_tag}" | head -n 1 || true
)"

[[ -n "$latest_full_tag" ]] || fatal_error "could not find an existing full release tag before '${new_full_tag}'"

if [[ ! "$latest_full_tag" =~ ^v([0-9]+)\.([0-9]+)$ ]]; then
  fatal_error "latest full release tag '$latest_full_tag' does not match the expected v<major>.<minor> format"
fi

latest_major="${BASH_REMATCH[1]}"
latest_minor="${BASH_REMATCH[2]}"
expected_package_version="${latest_major}.$((latest_minor + 1)).0"

[[ "$package_version" == "$expected_package_version" ]] || fatal_error "package.json version '$package_version' does not match the expected next minor release '$expected_package_version'"

if git rev-parse --verify --quiet "refs/tags/${new_full_tag}" >/dev/null; then
  new_full_tag_target="$(git rev-list -n 1 "${new_full_tag}")"
  [[ "$new_full_tag_target" == "$target_commit" ]] || fatal_error "tag '${new_full_tag}' already exists but points to '${new_full_tag_target}', expected '${target_commit}'"
fi

remote_full_tag_sha="$(git ls-remote --tags --refs origin "refs/tags/${new_full_tag}" | awk '{ print $1 }')"
if [[ -n "$remote_full_tag_sha" ]]; then
  git rev-parse --verify --quiet "refs/tags/${new_full_tag}" >/dev/null || fatal_error "tag '${new_full_tag}' exists on origin but was not fetched locally"
  remote_full_tag_target="$(git rev-list -n 1 "${new_full_tag}")"
  [[ "$remote_full_tag_target" == "$target_commit" ]] || fatal_error "tag '${new_full_tag}' exists on origin but points to '${remote_full_tag_target}', expected '${target_commit}'"
fi

echo "Package version:         ${package_version}"
echo "Previous full tag:       ${latest_full_tag}"
echo "New full release tag:    ${new_full_tag}"
echo "Movable major tag:       ${major_tag}"
echo "Target commit:           ${target_commit}"

# Keep the GitHub Release tied to the permanent tag, not the movable major alias.
# Moving the major alias comes after this succeeds so a failed release does not advance the public alias.
if gh release view "${new_full_tag}" >/dev/null 2>&1; then
  echo "GitHub Release already exists for ${new_full_tag}; marking it published and latest."
  gh release edit "${new_full_tag}" --draft=false --latest
  release_url="$(gh release view "${new_full_tag}" --json url --jq .url)"
else
  echo "Creating latest GitHub Release for ${new_full_tag}..."
  release_args=(
    "${new_full_tag}"
    --latest
    --title "${new_full_tag}"
    --generate-notes
    --notes-start-tag "${latest_full_tag}"
  )

  if [[ -n "$remote_full_tag_sha" ]]; then
    release_args+=(--verify-tag)
  else
    release_args+=(--target "${target_commit}")
  fi

  release_url="$(gh release create "${release_args[@]}")"
fi

git tag -f "${major_tag}" "${target_commit}"

echo "Force-updating ${major_tag} on origin..."
git push --force origin "refs/tags/${major_tag}"

echo "Release tags published: ${new_full_tag}, ${major_tag}"
echo "GitHub Release created: ${release_url}"
