#!/usr/bin/env bash

# Treat any unexpected failure as release-blocking so we do not leave the release flow half-finished.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/cut-minor-release.sh

Runs the full minor release flow.

- Creates the release PR for the next minor version
- Waits for that version bump to land on `main`
- Publishes the release tags from the merged `main` commit

The script waits up to 30 minutes, checking `main` once per minute.
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

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fatal_error "run this script from inside a git repository"
command -v node >/dev/null 2>&1 || fatal_error "node is required to read package.json while waiting for the merge"

# Resolve sibling scripts relative to this file so the wrapper still works when invoked from another directory in the repo.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
prepare_script="${script_dir}/create-minor-release-pr.sh"
tag_script="${script_dir}/tag-minor-release.sh"

[[ -x "${prepare_script}" ]] || fatal_error "release preparation script '${prepare_script}' is not executable"
[[ -x "${tag_script}" ]] || fatal_error "release tagging script '${tag_script}' is not executable"

"${prepare_script}"

# The PR preparation script leaves us on the release branch that contains the new version bump.
# Capture that version now so we know exactly what to wait for on main.
expected_package_version="$(node -p "require('./package.json').version")"

echo "Waiting for package.json version ${expected_package_version} to reach main..."
git checkout main

# Auto-merge and CI are asynchronous, so poll main until the expected version shows up or we hit the time limit.
deadline=$((SECONDS + 1800))
while (( SECONDS < deadline )); do
  git pull --ff-only origin main

  current_package_version="$(node -p "require('./package.json').version")"
  if [[ "$current_package_version" == "$expected_package_version" ]]; then
    echo "Version ${expected_package_version} is now on main."
    "${tag_script}"
    exit 0
  fi

  echo "main is still at ${current_package_version}; checking again in 60 seconds..."
  sleep 60
done

fatal_error "timed out waiting for package.json version ${expected_package_version} to land on main"
