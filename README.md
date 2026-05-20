This project is based on the standalone [n24-live-tracker](https://github.com/arthurbes/n24-live-tracker) made by [arthurbes](https://github.com/arthurbes)
### Overview

This project provides a **real-time telemetry dashboard** for the Nürburgring 24 Hours (N24) endurance race. It connects to the official Live Timing feed, processes telemetry in a Node.js backend, and displays a smooth interactive map + leaderboard in a React frontend.

The repository includes a ready-to-use `docker-compose.yml` for easy deployment.

### Prerequisites

- **Docker** and **Docker Compose**
- Git
- A **Mapbox Token**

### Step 1: Clone the Repository

```bash
git clone https://github.com/midikeyboard/n24-live-tracker-docker.git
cd n24-live-tracker-docker
```

### Step 2: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
# Required: Your Mapbox public token
MAPBOX_TOKEN=pk.eyJ1...

# Optional: Enable replay mode (for recorded telemetry)
REPLAY_MODE=false
# REPLAY_MODE=true
# REPLAY_FILE=replay_window_0000_0130.jsonl.gz
```

> **Note**: For replay mode, place your `.jsonl.gz` files in a `./replays` folder in the project root.

### Step 3: Run with Docker Compose

#### Production / Normal Run

```bash
docker compose up -d --build
```

#### View Logs

```bash
# Backend logs
docker logs backend -f

# Frontend logs
docker logs frontend -f
```

#### Stop the services

```bash
docker compose down
```

### Ports & Access

| Service   | Port (host) | URL                          |
|-----------|-------------|------------------------------|
| Frontend  | 5173        | http://localhost:5173        |
| Backend   | 3001        | http://localhost:3001        |

Open **http://localhost:5173** in your browser.

### Replay Mode

1. Set in `.env`:
   ```env
   REPLAY_MODE=true
   REPLAY_FILE=replay_window_0000_0130.jsonl.gz
   ```
2. Place the replay file in `./replays/`
3. Rebuild and restart:
   ```bash
   docker compose up -d --build
   ```

### Project Structure (relevant parts)

- `docker-compose.yml` — Main orchestration
- `backend` — Backend container
- `frontend` — Frontend container
- `./replays/` — Directory for replay files (mounted as volume)
- `./data/` — Persistent data volume

### Common Commands

```bash
# Rebuild everything
docker compose up -d --build

# Rebuild only backend
docker compose up -d --build backend

# View all containers
docker ps

# Clean volumes (if needed)
docker compose down -v
```

### Troubleshooting

- **Map not loading?** → Check that `MAPBOX_TOKEN` is correctly set in `.env` and restart the frontend.
- **Connection issues between services?** → The compose file uses internal networking (`backend` and `frontend` service names).
- **Permission issues?** → Both containers currently run as `root` (as defined in Dockerfiles).
- **Replay not working?** → Verify the file exists in `./replays/` and the filename matches `REPLAY_FILE`.
