#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PREVIEW_URL="$(python3 "$ROOT_DIR/tools/release/local-preview.py")"
open "$PREVIEW_URL"
