#!/bin/bash
# Download N24 replay files from v1.0.0-replays release

set -e  # Exit on error

REPO="arthurbes/n24-live-tracker"
TAG="v1.0.0-replays"
DEST_DIR="./backend/replays"

echo "Creating directory $DEST_DIR ..."
mkdir -p "$DEST_DIR"

# List of the 4 json.gz files (adjust names if they differ)
FILES=(
  "replay_window_0000_0130.jsonl.gz"
  "replay_window_0130_0300.jsonl.gz"
  "replay_window_0600_0730.jsonl.gz"
  "replay_window_0830_1030.jsonl.gz"
)

BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

cd "$DEST_DIR"

echo "Downloading replay files..."
for file in "${FILES[@]}"; do
  echo "→ Downloading $file ..."
  curl -L -# -o "$file" "${BASE_URL}/${file}"
done

echo "✅ All files downloaded to $DEST_DIR"
ls -lh