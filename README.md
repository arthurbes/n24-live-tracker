
![N24H Tracker Preview](docs/assets/N24H-LIVE-TRACKER-GREEN-HELL-05-16-2026_08_54_PM.png)

This project is based on the standalone [n24-live-tracker](https://github.com/arthurbes/n24-live-tracker) made by [arthurbes](https://github.com/arthurbes)

## [Read the documentation here](https://arthurbes.github.io/n24-live-tracker/)


A professional, real-time live tracking telemetry dashboard for the **Nürburgring 24h (N24)** endurance race. 

This system connects directly to the official Live Timing Azure WebSocket feed, interpolates vehicle telemetry in a lightweight backend, and renders smooth, highly tactical real-time car positions along the 25.3km Nordschleife circuit using Mapbox and React.

## 🚀 Features
- **Real-Time Map Interpolation**: Calculates vehicle movement between sectors based on instantaneous radar speeds, offering smooth position tracking without ghosting.
- **Dynamic Leaderboard**: Alternating live data (every 20s) showing Gaps, Intervals, Last Lap Times, and Real-Time Driver/Model information.
- **Code 60 Detection Engine**: A heuristical mathematical backend engine that dynamically detects when a track sector enters a 'Code 60' slow-zone and overlays a warning layer on the UI map.
- **Pit-Stop & Incident Detection**: Intelligent tracking that identifies if a car is entering the pit lane or if it has crashed/stopped on the track, updating UI badges accordingly.
- **Premium UI/UX Aesthetics**: Features a Glassmorphism design system built with TailwindCSS, tailored to look like a multi-million-dollar tactical endurance race command center.
  

## 🛠️ Tech Stack
- **Backend**: Node.js, Socket.io (WebSocket), Turf.js (Geospatial logic).
- **Frontend**: React, Vite, Tailwind CSS, React-Map-GL (Mapbox).

**Note**: The repository includes a ready-to-use `docker-compose.yml` for easy deployment.

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


<br>

# Using Replay Mode (optional)

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

