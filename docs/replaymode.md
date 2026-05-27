---
title: Replay Mode
parent: Home
nav_order: 3
---

# Replay Mode

## Initial set-up

1. Set in `.env`:
   ```bash
   REPLAY_MODE=true
   REPLAY_FILE=replay_window_0000_0130.jsonl.gz
   ```
2. Download and place the **uncompressed** replay file in `./backend/replays/` <br>*or*   download using `./download_replays.sh` script.
3. Rebuild and restart:
   ```bash
   docker-compose up -d --build
   ```

