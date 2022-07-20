#!/usr/bin/env bash

# Script requirements:
# - jq

# Fail on first error, on undefined variables, and on failures in pipelines.
set -euo pipefail

# Go to the repo root directory.
cd "$(git rev-parse --show-toplevel)"

crates="$(cargo metadata --format-version 1 | \
    jq --exit-status -r \
        '.workspace_members[] as $key | .packages[] | select(.id == $key) | .name')"
crate_count="$(echo -e "${crates}" | wc -l)"

if [[ "$crate_count" == "1" ]]; then
    echo -e "${crates}"
    exit 0
else
    echo >&2 "Multiple crates in workspace, please specify a crate in the 'crate-name' setting."
    exit 1
fi
