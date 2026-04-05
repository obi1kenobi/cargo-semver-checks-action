#!/usr/bin/env bash

# Treat any unexpected failure as release-blocking so we do not open a half-finished release PR.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/create-minor-release-pr.sh

Creates the release PR for the next minor version.

- Starts from the current `main` checkout
- Syncs `main` and tags from `origin`
- Creates a dedicated release branch
- Updates `package.json` and `package-lock.json`
- Commits and pushes the version bump
- Opens a PR to `main`
- Enables squash auto-merge for that PR
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

# Build the release PR from the current upstream main branch so the PR contains only the version bump.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fatal_error "run this script from inside a git repository"
[[ "$(git branch --show-current)" == "main" ]] || fatal_error "run this script from the 'main' branch"
[[ -f package.json ]] || fatal_error "package.json was not found"
[[ -f package-lock.json ]] || fatal_error "package-lock.json was not found"
command -v npm >/dev/null 2>&1 || fatal_error "npm is required to update package metadata"
command -v gh >/dev/null 2>&1 || fatal_error "gh is required to create and manage the release PR"

# A release PR should be the only change on the branch, so start from a fully clean checkout.
if [[ -n "$(git status --porcelain)" ]]; then
  fatal_error "working tree is not clean; commit, stash, or remove changes before preparing a release PR"
fi

git remote get-url origin >/dev/null 2>&1 || fatal_error "remote 'origin' does not exist"

# Sync both main and the release tags before deciding which version comes next.
echo "Refreshing main from origin..."
git pull --ff-only origin main

# We force tag updates because this repo intentionally uses movable major tags like v1 and v2.
# Without force, a stale local alias can block fetch from updating to the remote's current target.
echo "Fetching tags from origin..."
git fetch origin --tags --force

# Refuse to build a release branch from a local-only main commit.
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || fatal_error "local 'main' does not match origin/main after pulling"

# Minor releases advance from the highest permanent v<major>.<minor> tag, not from the movable v<major> alias.
latest_full_tag="$(
  git tag --list "v*.*" --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+$' | head -n 1 || true
)"

[[ -n "$latest_full_tag" ]] || fatal_error "could not find an existing full release tag"

if [[ ! "$latest_full_tag" =~ ^v([0-9]+)\.([0-9]+)$ ]]; then
  fatal_error "latest full release tag '$latest_full_tag' does not match the expected v<major>.<minor> format"
fi

major="${BASH_REMATCH[1]}"
minor="${BASH_REMATCH[2]}"
next_minor=$((minor + 1))

new_package_version="${major}.${next_minor}.0"
new_full_tag="v${major}.${next_minor}"
release_branch="pg/release-v${new_package_version}"
commit_message="Bump version to ${new_package_version}."
pr_body=$(
  cat <<EOF
Prepare release ${new_full_tag}.

This PR was created by scripts/create-minor-release-pr.sh.
EOF
)

if git show-ref --verify --quiet "refs/heads/${release_branch}"; then
  fatal_error "local branch '${release_branch}' already exists"
fi

echo "Creating release branch: ${release_branch}"
git checkout -b "${release_branch}"

# Let npm own the package.json/package-lock.json update so their formatting stays npm-controlled.
echo "Updating package metadata to ${new_package_version}..."
npm version "${new_package_version}" --no-git-tag-version

git add package.json package-lock.json

# The checkout started clean and we staged the two files npm is expected to touch.
# Any other status entry means npm or a hook changed something we did not plan to release.
staged_version_files="$(git diff --cached --name-only -- package.json package-lock.json | sort)"
expected_staged_files=$'package-lock.json\npackage.json'
[[ "$staged_version_files" == "$expected_staged_files" ]] || fatal_error "expected npm version to update package.json and package-lock.json"

unexpected_status="$(git status --porcelain | grep -vE '^M  package\.json$|^M  package-lock\.json$' || true)"
[[ -z "$unexpected_status" ]] || fatal_error "unexpected changes remain after npm version; inspect git status before continuing"

git commit -m "${commit_message}"

echo "Pushing ${release_branch} to origin..."
git push --set-upstream origin "${release_branch}"

echo "Opening release PR..."
pr_url="$(gh pr create --base main --head "${release_branch}" --title "${commit_message}" --body "${pr_body}")"

# Recent repository history uses squash merges, so keep the automated release PR consistent with that flow.
echo "Enabling auto-merge for ${pr_url}..."
gh pr merge --auto --squash "${pr_url}"

echo "Release PR created: ${pr_url}"
