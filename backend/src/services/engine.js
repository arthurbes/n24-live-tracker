const turf = require('@turf/turf');
const timingFeed = require('./timingFeed');
const path = require('path');
const fs = require('fs');

const LAYOUT_FILES = {
  N24: 'nurburgring_geojson.json',
  NLS: 'langstrecken_geojson.json',
  GP:  'grandprix_geojson.json'
};

const SECTOR_FILES = {
  N24: 'sectors_n24.json',
  NLS: 'sectors_nls.json',
  GP:  'sectors_gp.json'
};

// Length of the track layouts in kilometers, used to scale distances to GeoJSON.
const LAYOUT_REAL_LENGTHS = {
  N24: 25.378,
  NLS: 24.358,
  GP:  5.148
};

class Engine {
  constructor() {
    this.currentLayout = 'N24';
    this.loadLayout('N24');
  }

  /**
   * Load (or switch to) a track layout.
   * @param {'N24'|'NLS'|'GP'} layout
   */
  loadLayout(layout = 'N24') {
    const key = LAYOUT_FILES[layout] ? layout : 'N24';
    const geoFileName = LAYOUT_FILES[key];
    const geoPath = path.join(
      __dirname,
      '..', '..', '..',
      'frontend', 'src',
      geoFileName
    );

    if (!fs.existsSync(geoPath)) {
      console.error(`[Engine] GeoJSON not found: ${geoPath}`);
      if (key !== 'N24') {
        return this.loadLayout('N24');
      }
      throw new Error(`Critical: N24 GeoJSON missing at ${geoPath}`);
    }

    this.trackGeoJSON = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
    this.trackLine = this.trackGeoJSON.features
      ? this.trackGeoJSON.features[0]
      : this.trackGeoJSON;

    this.trackLengthKm = turf.length(this.trackLine, { units: 'kilometers' });
    const sectorFileName = SECTOR_FILES[key];
    const sectorPath = path.join(__dirname, '..', 'data', sectorFileName);

    if (!fs.existsSync(sectorPath)) {
      console.error(`[Engine] Sectors file not found: ${sectorPath}`);
      if (key !== 'N24') {
        return this.loadLayout('N24');
      }
      throw new Error(`Critical: sectors_n24.json missing at ${sectorPath}`);
    }

    const sectors = JSON.parse(fs.readFileSync(sectorPath, 'utf8'));
    const realLength = LAYOUT_REAL_LENGTHS[key] || this.trackLengthKm;
    const scale = this.trackLengthKm / realLength;

    this.sectorDistances = sectors.map(s => s.distanceKm * scale);
    this.currentLayout = key;

    console.log(
      `[Engine] Loaded layout "${key}" – ` +
      `GeoJSON ${this.trackLengthKm.toFixed(3)} km, ` +
      `sectors from ${sectorFileName}, ` +
      `scale ${scale.toFixed(4)}`
    );
  }

  setLayout(layout) {
    this.loadLayout(layout);
  }

  getInterpolatedPositions() {
    const carStates = timingFeed.getCarStates();
    const now = Date.now();
    const positions = [];

    Object.values(carStates).forEach(car => {
      const elapsed = now - car.lastSectorTime;
      let ratio = elapsed / car.expectedDurationMs;

      // Cap ratio to avoid going past the next sector before it officially triggers
      if (ratio > 0.99) ratio = 0.99;
      if (ratio < 0) ratio = 0;

      const currentSectorDist = this.sectorDistances[car.currentSectorIdx] ?? 0;
      let nextSectorIdx = (car.currentSectorIdx + 1) % this.sectorDistances.length;
      let nextSectorDist = this.sectorDistances[nextSectorIdx];

      if (nextSectorDist <= currentSectorDist) {
        nextSectorDist = this.trackLengthKm; // Wrapping around
      }

      let currentTrackDist = currentSectorDist + ratio * (nextSectorDist - currentSectorDist);

      // Keep distance inside the track
      if (currentTrackDist > this.trackLengthKm) {
        currentTrackDist = currentTrackDist % this.trackLengthKm;
      }

      // Calculate coordinates
      const currentPoint = turf.along(this.trackLine, currentTrackDist, { units: 'kilometers' });

      // Calculate bearing
      let aheadDist = currentTrackDist + 0.05;
      if (aheadDist > this.trackLengthKm) {
        aheadDist -= this.trackLengthKm;
      }
      const pointAhead = turf.along(this.trackLine, aheadDist, { units: 'kilometers' });
      const bearing = turf.bearing(currentPoint, pointAhead);

      positions.push({
        id: car.id,
        number: car.number,
        class: car.class,
        driver: car.driver,
        carModel: car.carModel,
        lastLapTime: car.lastLapTime,
        gap: car.gap,
        interval: car.interval,
        laps: car.laps,
        inPit: car.inPit,
        position: car.position,
        classPosition: car.classPosition,
        speed: car.speed,
        lng: currentPoint.geometry.coordinates[0],
        lat: currentPoint.geometry.coordinates[1],
        bearing: bearing
      });
    });

    return {
      positions: positions,
      code60Sectors: timingFeed.getCode60Sectors()
    };
  }
}

module.exports = new Engine();