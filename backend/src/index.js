const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const timingFeed = require('./services/timingFeed');
const engine = require('./services/engine');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get('/', (req, res) => {
  res.send('N24 Live Tracker Backend is running.');
});

// Start the feed or replay based on environment
if (process.env.REPLAY_MODE === 'true') {
  const replayPlayer = require('./services/replayPlayer');
  replayPlayer.start(process.env.REPLAY_FILE);
} else {
  timingFeed.start();
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send initial state if needed
  socket.emit('initial_state', timingFeed.getCarStates());

  // Allow frontend to switch track layout
  socket.on('setTrackLayout', (layout) => {
    if (['N24', 'NLS', 'GP'].includes(layout)) {
      engine.setLayout(layout);
      console.log(`Track layout switched to ${layout} by client ${socket.id}`);
      
      // Optional: notify all clients of the new layout
      io.emit('trackLayoutChanged', layout);
    } else {
      console.warn(`Invalid track layout requested: ${layout}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// High-frequency telemetry broadcast loop
setInterval(() => {
  io.emit('telemetry', {
    positions: engine.getInterpolatedPositions().positions,
    code60Sectors: timingFeed.getCode60Sectors(),
    serverTime: Date.now(),
    weather: timingFeed.currentWeather || { icon: '☀️', air: '18°C', track: '24°C' }
  });
}, 200); // 5Hz update rate

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});