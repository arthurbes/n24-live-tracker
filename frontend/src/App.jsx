import { useState, useEffect } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import { io } from 'socket.io-client';
import 'mapbox-gl/dist/mapbox-gl.css';
import trackData from './nurburgring_geojson.json';
import cornersData from './corners.json';
import sectorsData from './sectors.json';
import * as turf from '@turf/turf';

const socket = io('http://localhost:3001');

function App() {
  const [cars, setCars] = useState([]);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledClasses, setEnabledClasses] = useState(import.meta.env.VITE_ENABLED_CLASSES.split(',').map(c => c.trim()));
  const [hoveredCarId, setHoveredCarId] = useState(null);
  const [code60Sectors, setCode60Sectors] = useState([]);
  const [leaderboardMode, setLeaderboardMode] = useState(0);
  const [nowTime, setNowTime] = useState(Date.now());
  const [weather, setWeather] = useState({ icon: '☀️', air: '18°C', track: '24°C' });

  useEffect(() => {
    socket.on('telemetry', (data) => {
      if (Array.isArray(data)) {
        setCars(data);
      } else {
        setCars(data.positions);
        setCode60Sectors(data.code60Sectors);
        if (data.serverTime) setNowTime(data.serverTime);
        if (data.weather) setWeather(data.weather);
      }
    });

    const modeInterval = setInterval(() => {
      setLeaderboardMode(prev => (prev === 0 ? 1 : 0));
    }, 20000);

    const clockInterval = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => {
      socket.off('telemetry');
      clearInterval(modeInterval);
      // clockInterval removed as we rely on serverTime, but fallback if backend doesn't send
      clearInterval(clockInterval);
    };
  }, []);

  const availableClasses = ['All', ...new Set(cars.map(c => c.class))].filter(Boolean).filter(c => c === 'All' || enabledClasses.includes(c));
  const filteredCars = cars.filter(car => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!car.driver.toLowerCase().includes(query) && !car.number.toString().includes(query)) {
        return false;
      }
    }
    if (filter === 'All') return true;
    if (car.class === filter) return true;
    return false;
  });

  const sortedFilteredCars = [...filteredCars].sort((a, b) => {
    // Treat position 0 as max to put cars without position at the end
    const posA = a.position || 999;
    const posB = b.position || 999;
    return posA - posB;
  });

  const trackLengthKm = 25.378;
  const trackLine = trackData.features ? trackData.features[0] : trackData;

  // May 16, 2026, 10:00 BRT = May 16, 13:00 UTC. Race ends 24h later = May 17, 13:00 UTC
  const raceEndTime = new Date("2026-05-17T13:00:00Z").getTime();
  const timeLeftMs = Math.max(0, raceEndTime - nowTime);
  const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
  const secondsLeft = Math.floor((timeLeftMs % (1000 * 60)) / 1000);
  const countdownString = `${String(hoursLeft).padStart(2, '0')}:${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
  const germanyTime = new Date(nowTime).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const code60GeoJSON = {
    type: 'FeatureCollection',
    features: code60Sectors.map(sectorIdx => {
      const startDist = sectorsData[sectorIdx].distanceKm;
      const nextIdx = (sectorIdx + 1) % sectorsData.length;
      let endDist = sectorsData[nextIdx].distanceKm;
      if (endDist <= startDist) endDist = trackLengthKm;

      // Scale distances since our line might not perfectly match 25.378
      const actualLineLength = turf.length(trackLine, { units: 'kilometers' });
      const scale = actualLineLength / trackLengthKm;

      return turf.lineSliceAlong(trackLine, startDist * scale, endDist * scale, { units: 'kilometers' });
    })
  };

  return (
    <>
      <header className="hidden md:flex justify-between items-center px-margin-desktop py-2 w-full fixed top-0 z-50 bg-surface/60 backdrop-blur-md border-b border-white/10 font-body-fixed text-body-fixed text-primary">
        <div className="flex items-center gap-4">
          <span className="font-display-lg text-headline-lg font-extrabold text-primary tracking-tighter uppercase">N24H LIVE TRACKER</span>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search Driver or #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface-container-highest/80 border border-white/20 rounded px-3 py-1 text-sm text-white placeholder-white/50 focus:outline-none focus:border-primary w-64"
          />
        </div>
        <nav className="flex items-center gap-8">
          <div className="w-10"></div>{/* Spacer for right alignment since we removed leaderboard link */}
        </nav>
      </header>

      <main className="flex-grow relative w-full h-screen pb-[80px] md:pb-0 overflow-hidden">
        <Map
          initialViewState={{
            longitude: 6.9475,
            latitude: 50.3341,
            zoom: 12
          }}
          mapStyle={import.meta.env.VITE_MAPBOX_STYLE}
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        >
          <Source id="track" type="geojson" data={trackData}>
            <Layer
              id="track-line"
              type="line"
              paint={{
                'line-color': '#c3f400',
                'line-width': 4,
                'line-opacity': 0.3
              }}
            />
          </Source>

          {code60Sectors.length > 0 && (
            <Source id="code60" type="geojson" data={code60GeoJSON}>
              <Layer
                id="code60-line"
                type="line"
                paint={{
                  'line-color': '#ffea00',
                  'line-width': 6,
                  'line-dasharray': [2, 2]
                }}
              />
            </Source>
          )}

          <Source id="corners" type="geojson" data={cornersData}>
            <Layer
              id="corners-labels"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-size': 12,
                'text-anchor': 'top',
                'text-offset': [0, 0.5]
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(0,0,0,0.8)',
                'text-halo-width': 2
              }}
            />
          </Source>

          {sortedFilteredCars.map(car => (
            <Marker key={car.id} longitude={car.lng} latitude={car.lat} anchor="center">
              <div
                className={`flex items-center group cursor-pointer ${hoveredCarId === car.id ? 'z-50' : 'z-10 hover:z-50'}`}
                style={{ transform: `rotate(${car.bearing}deg)` }}
                onMouseEnter={() => setHoveredCarId(car.id)}
                onMouseLeave={() => setHoveredCarId(null)}
              >
                <div className="relative w-4 h-4">
                  <div className={`absolute inset-0 rounded-full ${car.speed > 10 ? 'animate-ping' : ''} opacity-75 ${car.class === 'SP9' ? 'bg-primary-container' : car.class === 'CUP2' ? 'bg-tertiary-container' : 'bg-outline'}`}></div>
                  <div className="absolute inset-1 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
                </div>
                
                {/* Fixed orientation popup container */}
                <div 
                  className={`absolute left-1/2 top-1/2 w-0 h-0 pointer-events-none transition-opacity duration-200 ${hoveredCarId === car.id ? 'opacity-100 z-50' : 'opacity-0 group-hover:opacity-100 z-50'}`}
                  style={{ transform: `rotate(${-car.bearing}deg)` }}
                >
                  <div className="absolute top-0 left-2 w-6 h-px bg-white/80"></div>
                  <div className="absolute -top-7 left-8 bg-surface-container-highest/90 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-DEFAULT w-max shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                    <div className="font-label-caps text-label-caps text-secondary-fixed mb-0.5">
                      {car.class} {car.position > 0 && `| P${car.position}`} {car.classPosition > 0 && `(C${car.classPosition})`}
                      {car.inPit && <span className="ml-2 text-orange-400 font-bold bg-orange-400/20 px-1 rounded">IN PIT</span>}
                      {car.speed <= 10 && !car.inPit && <span className="ml-2 text-error font-bold">STOPPED</span>}
                    </div>
                    <div className="font-body-fixed text-body-fixed text-on-surface text-sm flex items-center gap-2">
                      <span className="bg-primary-container text-on-primary-container px-1 py-0.5 rounded text-xs font-bold">#{car.number}</span>
                      {car.driver}
                    </div>
                  </div>
                </div>
              </div>
            </Marker>
          ))}
        </Map>

        {/* Sidebar - Leaderboard */}
        <aside className="absolute top-20 bottom-8 left-margin-desktop w-[450px] z-10 flex flex-col bg-surface-container-highest/90 backdrop-blur-2xl border-t border-l border-white/10 border-r border-b border-black/50 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] pointer-events-none md:pointer-events-auto">
          <div className="px-widget-padding py-4 border-b border-white/10 bg-surface-container-low/50 flex justify-between items-center">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight uppercase">LEADERBOARD</h2>
            </div>
          </div>
          <div className="flex-grow overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse pointer-events-auto">
              <thead className="sticky top-0 bg-surface-container-highest/95 backdrop-blur-md z-10 border-b border-white/10">
                <tr className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                  <th className="py-2 pl-4 pr-2 font-normal w-10">Pos</th>
                  <th className="py-2 px-2 font-normal w-12">Car</th>
                  <th className="py-2 px-2 font-normal">Driver / Model</th>
                  <th className="py-2 pr-4 pl-2 font-normal text-right w-28">
                    {leaderboardMode === 0 ? 'Last Lap / Gap' : 'Lap / INT'}
                  </th>
                </tr>
              </thead>
              <tbody className="font-body-fixed text-body-fixed text-sm">
                {sortedFilteredCars.map((car) => (
                  <tr 
                    key={car.id} 
                    className={`border-b border-white/5 transition-colors border-l-4 group cursor-pointer ${hoveredCarId === car.id ? 'bg-white/10 border-l-primary' : 'hover:bg-white/5 border-transparent'}`}
                    onMouseEnter={() => setHoveredCarId(car.id)}
                    onMouseLeave={() => setHoveredCarId(null)}
                  >
                    <td className="py-3 pl-4 pr-2 text-on-surface-variant font-bold text-lg">
                      {car.position > 0 ? car.position : '-'}
                    </td>
                    <td className="py-3 px-2">
                      <span className="bg-primary-container text-on-primary-container px-1.5 py-0.5 rounded-DEFAULT font-status-sm text-status-sm">#{car.number}</span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-on-surface truncate w-40 flex items-center gap-1">
                        {car.driver}
                        {car.inPit && <span className="w-2 h-2 rounded-full bg-orange-400 ml-1" title="In Pit"></span>}
                        {car.speed <= 10 && !car.inPit && <span className="w-2 h-2 rounded-full bg-error ml-1" title="Stopped"></span>}
                      </div>
                      <div className="text-on-surface-variant text-xs truncate w-40" title={car.carModel}>
                        {car.carModel}
                      </div>
                      <div className="text-on-surface-variant font-status-sm text-status-sm flex gap-1 mt-0.5">
                        {car.class} <span className="text-secondary-fixed opacity-70">C{car.classPosition > 0 ? car.classPosition : '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 pl-2 text-right">
                      {car.position === 1 ? (
                        leaderboardMode === 0 ? (
                          <div className="text-primary font-bold">{car.lastLapTime || '-'}</div>
                        ) : (
                          <div className="text-secondary-fixed font-bold">Lap {car.laps || '-'}</div>
                        )
                      ) : (
                        leaderboardMode === 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-on-surface font-bold">{car.lastLapTime || '-'}</span>
                            <span className="text-on-surface-variant text-xs">{car.gap || '-'}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-error font-bold">{car.interval || '-'}</span>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>
        {/* Right Info Panel */}
        <div className="absolute top-20 right-margin-desktop z-10 flex flex-col gap-3">
          <div className="bg-surface-container-highest/90 backdrop-blur-md border border-white/10 p-4 rounded-lg shadow-lg pointer-events-none">
            <div className="text-secondary-fixed text-xs font-label-caps uppercase mb-1">Time Remaining</div>
            <div className="text-4xl font-headline-lg font-bold text-white mb-3">
              {countdownString}
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
              <div>
                <div className="text-on-surface-variant text-[10px] font-label-caps uppercase">Local Time (Nürburg)</div>
                <div className="text-white text-lg font-body-fixed">{germanyTime}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-[10px] font-label-caps uppercase">Weather</div>
                <div className="text-white text-sm font-body-fixed flex items-center gap-1">
                  {weather.icon} {weather.air}
                </div>
                <div className="text-on-surface-variant text-xs mt-0.5">Track: {weather.track}</div>
              </div>
            </div>
          </div>
        </div>
        {/* Stream Overlay */}
        {import.meta.env.VITE_STREAMURL && import.meta.env.VITE_STREAMURL.trim() !== '' && (
        <div className="absolute bottom-10 right-margin-desktop z-10 w-[80vw] md:w-[20vw] aspect-video bg-black/80 border border-white/20 rounded-lg overflow-hidden shadow-lg">
         <iframe
            src={import.meta.env.VITE_STREAMURL}
            title="Live Stream"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>
        )}
      </main>

      <div className="hidden md:flex fixed top-24 left-1/2 -translate-x-1/2 z-20 items-center gap-2 bg-surface-container-low/60 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-lg">
        {availableClasses.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`${filter === f ? 'bg-secondary-container text-on-secondary-container shadow-[0_0_10px_rgba(195,244,0,0.2)]' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'} px-4 py-1.5 rounded-full font-label-caps text-label-caps uppercase transition-colors`}
          >
            {f}
          </button>
        ))}
      </div>
    </>
  );
}

export default App;
