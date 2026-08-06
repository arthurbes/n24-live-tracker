const EventEmitter = require('events');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const recorder = require('./recorder');
const sectors = require('../data/sectors_n24.json');

class TimingFeed extends EventEmitter {
  constructor() {
    super();
    this.carStates = {};
    this.fallbackSpeeds = {
      'SP 9': 160,
      'Cup 2': 145,
      'TCR': 135,
      'default': 140
    };
    this.currentWeather = { icon: '☀️', air: '18°C', track: '24°C' };
    this.fetchWeather();
    setInterval(() => this.fetchWeather(), 10 * 60 * 1000); // Every 10 min
  }

  async fetchWeather() {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=50.3341&longitude=6.9427&current_weather=true');
      const data = await res.json();
      const temp = data.current_weather.temperature;
      this.currentWeather = {
        icon: data.current_weather.weathercode <= 3 ? '☀️' : '☁️',
        air: `${Math.round(temp)}°C`,
        track: `${Math.round(temp + 6)}°C`
      };
    } catch (e) {
      console.error('Failed to fetch weather:', e);
    }
  }

  processLivePayload(payload) {
    if (!payload || !payload.RESULT) return;
    
    const now = Date.now();
    
    payload.RESULT.forEach(rawCar => {
      let currentSectorIdx = parseInt(rawCar.LASTINTERMEDIATENUMBER || '0', 10);
      if (isNaN(currentSectorIdx)) currentSectorIdx = 0;
      // Cap the sector index to our sectors array length to avoid out of bounds
      if (currentSectorIdx >= sectors.length) {
        currentSectorIdx = sectors.length - 1;
      }
      
      const speedProp = `S${currentSectorIdx}SPEED`;
      let speedKmh = parseFloat(rawCar[speedProp]);
      
      if (!speedKmh || speedKmh < 30) {
        speedKmh = this.fallbackSpeeds[rawCar.CLASSNAME] || this.fallbackSpeeds['default'];
      }

      let formattedClass = rawCar.CLASSNAME;
      if (formattedClass === 'SP 9') formattedClass = 'SP9';
      if (formattedClass === 'Cup 2') formattedClass = 'CUP2';

      let lastSectorTime = parseInt(rawCar.LASTIMTIME || '0', 10);
      if (!lastSectorTime) lastSectorTime = now;
      
      const existingCar = this.carStates[rawCar.STNR];
      
      // If we already track this car, only update the lastSectorTime if the sector actually changed
      // Otherwise, keep the old lastSectorTime so it continues to interpolate smoothly.
      if (existingCar && existingCar.currentSectorIdx === currentSectorIdx) {
        lastSectorTime = existingCar.lastSectorTime;
      } else {
        // Sector changed (or new car). To avoid clock drift issues between Azure and local,
        // we just set the last sector crossing time to NOW so it starts moving immediately.
        lastSectorTime = now;
      }

      let position = parseInt(rawCar.POSITION || '0', 10);
      let classPosition = parseInt(rawCar.CLASSRANK || '0', 10);

      this.carStates[rawCar.STNR] = {
        id: rawCar.STNR,
        number: rawCar.STNR,
        class: formattedClass,
        driver: rawCar.NAME,
        carModel: rawCar.CAR || '',
        lastLapTime: rawCar.LASTLAPTIME || '',
        gap: rawCar.GAP || '',
        interval: rawCar.INT || '',
        laps: rawCar.LAPS || '',
        inPit: rawCar.INPIT === "1" || rawCar.IN_PIT === "1" || rawCar.STATE === "PIT" || rawCar.GAP === "PIT" || rawCar.GAP === "IN PIT",
        position: position,
        classPosition: classPosition,
        currentSectorIdx: currentSectorIdx,
        lastSectorTime: lastSectorTime,
        speed: speedKmh,
        expectedDurationMs: this.calculateExpectedDuration(speedKmh, currentSectorIdx)
      };
    });
  }

  calculateExpectedDuration(speedKmh, currentSectorIdx) {
    const trackLengthKm = 25.378; 
    const currentDist = sectors[currentSectorIdx].distanceKm;
    const nextSectorIdx = (currentSectorIdx + 1) % sectors.length;
    let nextDist = sectors[nextSectorIdx].distanceKm;
    
    if (nextDist <= currentDist) {
      nextDist = trackLengthKm; 
    }
    
    const distanceKm = nextDist - currentDist;
    // Cap minimum speed to 10kmh so duration isn't Infinity
    const safeSpeed = Math.max(speedKmh, 10);
    const durationHours = distanceKm / safeSpeed;
    return durationHours * 3600 * 1000;
  }

  start() {
    this.connectWebSocket();
  }

  connectWebSocket() {
    console.log('Connecting to Live Timing Azure WebSocket...');
    const ws = new WebSocket('wss://livetiming.azurewebsites.net/');

    ws.on('open', () => {
      console.log('Live Timing connected!');
      const subscribeMsg = {
        eventId: "20",
        eventPid: [0, 4],
        clientLocalTime: Date.now()
      };
      ws.send(JSON.stringify(subscribeMsg));
    });

    ws.on('message', (data) => {
      try {
        const payload = JSON.parse(data);
        if (payload.PID === "LTS_TIMESYNC") {
          // Time sync message, ignore or use for clock drift calculation
          return;
        }
        if (payload.RESULT) {
          console.log(`Received ${payload.RESULT.length} cars from Live Timing.`);
          console.log("CARS:", payload.RESULT.map(c => c.STNR + ":" + c.LASTINTERMEDIATENUMBER).join(", ")); 
          
          // Trigger the recorder logic
          recorder.record(payload, this.currentWeather);

          this.processLivePayload(payload);
        }
      } catch (err) {
        // Ignore parse errors on ping/pong or other packets
      }
    });

    ws.on('close', () => {
      console.log('Live Timing disconnected. Reconnecting in 5s...');
      setTimeout(() => this.connectWebSocket(), 5000);
    });
    
    ws.on('error', (err) => {
      console.error('Live Timing WebSocket error:', err.message);
    });
  }

  getCarStates() {
    return this.carStates;
  }

  getCode60Sectors() {
    const code60Sectors = [];
    const now = Date.now();
    for (let i = 0; i < sectors.length; i++) {
      const carsInSector = Object.values(this.carStates).filter(c => c.currentSectorIdx === i);
      
      // Just 2 slow cars in a sector is enough to consider it Code 60, since the track is so large
      // and a 30% ratio is too strict.
      const slowCars = carsInSector.filter(c => {
        // If the car has been in this sector for way longer than expected, it probably crashed, pitted, or stopped.
        // We shouldn't let stuck cars permanently trigger a Code 60.
        const timeDiffMs = now - c.lastSectorTime;
        if (timeDiffMs > c.expectedDurationMs * 2) {
          return false;
        }
        return c.speed > 45 && c.speed < 75;
      }).length;

      if (slowCars >= 2) {
        code60Sectors.push(i);
      }
    }
    return code60Sectors;
  }
}

module.exports = new TimingFeed();
