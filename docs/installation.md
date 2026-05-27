---
title: Installation
parent: Home
nav_order: 2
---

# Installation

## Prerequisites:

- **Docker** and **Docker Compose**
- **Git**
- **Public Mapbox Token**

## Step 1: Clone the Repository

```bash
git clone https://github.com/arthurbes/n24-live-tracker.git
cd n24-live-tracker
```

## Step 2: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit the newly created `.env` and fill in your desired values:

```bash
MAPBOX_TOKEN=YOURTOKEN 
MAPBOX_STYLE=mapbox://styles/mapbox/satellite-streets-v12
REPLAY_MODE=false
REPLAY_FILE=replay_window_0000_0130.jsonl.gz
```

> See [MapBox styles](https://docs.mapbox.com/api/maps/styles/) for more styles or [create your own](https://www.mapbox.com/mapbox-studio).


## Step 3: Run with Docker Compose
#### Production / Normal Run
```bash
docker-compose up -d --build
```
## Step 4: Access the WebUI
The WebUI will become accessible locally via port: [5173](http://localhost:5173)
<br/>
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

## Ports & Access

| Service   | Port (host) | URL                          |
|-----------|-------------|------------------------------|
| Frontend  | 5173        | http://localhost:5173        |
| Backend   | 3001        | http://localhost:3001        |

## Troubleshooting

- Map not loading? → Check that `MAPBOX_TOKEN` is correctly set in `.env` and restart the frontend.
- Connection issues between services? → The compose file uses internal networking (`backend` and `frontend` service names).
- Permission issues? → Both containers currently run as `root` (as defined in Dockerfiles).
- Replay not working? → Verify the file exists in `./replays/` and the filename matches `REPLAY_FILE`.

