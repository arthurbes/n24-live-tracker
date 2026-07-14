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
  const enabledClasses = JSON.parse(localStorage.getItem('enabledClasses'));
  useEffect(() => {
    if (enabledClasses === null) {
      localStorage.setItem('enabledClasses', JSON.stringify(['SP9']));
    } else {
      localStorage.setItem('enabledClasses', JSON.stringify(enabledClasses));
    }
  }, [enabledClasses]);
  const [hoveredCarId, setHoveredCarId] = useState(null);
  const [code60Sectors, setCode60Sectors] = useState([]);
  const [leaderboardMode, setLeaderboardMode] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
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

  const filteredClasses = ['All', ...new Set(cars.map(c => c.class))].filter(Boolean).filter(c => c === 'All' || enabledClasses.includes(c));
  const availableClasses = [...new Set(cars.map(c => c.class))].filter(Boolean);
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
                  <div className="absolute -top-7 left-8  bg-surface-container-low/60 backdrop-blur-md border border-white/10 rounded-full px-2 py-2 rounded-DEFAULT w-max shadow-[0_0_15px_rgba(0,0,0,0.5)]">
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
        
        {/* Popup for available classes */}
        {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="backdrop-blur-lg bg-opacity-8 p-6 rounded-lg">
            <div className="flex justify-between items-start mb-4">
              {/* Title */}
              <h3 className="font-headline-md text-headline-md text-secondary-container">Available Classes:</h3>
              <button
              onClick={() => setShowPopup(false)}
                className="text-on-surface hover:text-on-surface/80 p-1 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
          </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Left column */}
              <div className="col-span-1">
                <ul className="list-disc px-2 list-inside mb-4">
              {availableClasses.sort().filter(c => c !== 'All').map(c => (
                <li
                  key={c}
                  className="flex items-center justify-between font-body-fixed text-body-fixed text-on-surface cursor-pointer hover:bg-surface-container-high/50 rounded-full px-2"
                  onClick={() => {
                    const currentClasses = JSON.parse(localStorage.getItem('enabledClasses') || '[]');
                    if (currentClasses.includes(c)) {
                      localStorage.setItem('enabledClasses', JSON.stringify(currentClasses.filter(cls => cls !== c)));
                    } else {
                      localStorage.setItem('enabledClasses', JSON.stringify([...currentClasses, c]));
                    }
                  }}
                >
                  <span>{c}</span>
                  {enabledClasses.includes(c) ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  )}
                </li>
              ))}
            </ul>
                <div className="mt-2">
              <a href="#"
                onClick={(e) => {
                  e.preventDefault();
                  const currentClasses = JSON.parse(localStorage.getItem('enabledClasses') || '[]');
                  const allClasses = availableClasses.filter(c => c !== 'All');
                  if (currentClasses.length === allClasses.length) {
                    localStorage.setItem('enabledClasses', JSON.stringify([]));
                  } else {
                    localStorage.setItem('enabledClasses', JSON.stringify(allClasses));
                  }
                }}
                className="text-secondary-container text-xs hover:text-on-surface rounded-full hover:bg-white/5"
              >
                <div className="flex justify-end">
                {enabledClasses.length === availableClasses.filter(c => c !== 'All').length ? 'unselect all' : 'select all'}
                </div>
              </a>
            </div>
              </div>

              {/* Right column with stream URL input */}
              <div className="col-span-1">
                <div className="mb-4">
                  <label htmlFor="streamUrl" className="block text-sm font-medium text-on-surface mb-1">
                    Stream URL:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                    type="text"
                    id="streamUrl"
                      value={localStorage.getItem('streamUrl') || ''}
                onChange={(e) => {
                  localStorage.setItem('streamUrl', e.target.value);
                }}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="Enter stream URL"
              />
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      localStorage.setItem('streamUrl', text);
                    } catch (err) {
                      console.error('Failed to read clipboard contents: ', err);
                    }
                  }}
                  className="p-2 bg-surface-container-low border border-outline rounded-md shadow-sm hover:bg-surface-container-high"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                </div>
              </div>
              </div>
            </div>

          </div>

        </div>
      )}
      
        {/* Sidebar - Leaderboard */}
        <aside className="absolute top-5 bottom-10 left-margin-desktop w-[450px] z-10 flex flex-col bg-surface-container-low/60 backdrop-blur-md border border-white/10 rounded-full overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] pointer-events-none hidden md:flex md:pointer-events-auto">
          <div className="px-widget-padding py-4 border-b border-white/10 flex justify-between items-center">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight uppercase">LEADERBOARD</h2>            
            </div>
          </div>
          <div className="flex-grow overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse pointer-events-auto">
              <thead className="sticky top-0 bg-surface-container-highest/50  z-10 border-b border-white/10">
                <tr className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                  <th className="py-2 pl-4 pr-2 font-normal w-10">Pos</th>
                  <th className="py-2 px-2 font-normal w-12">Car</th>
                  <th className="py-2 px-2 font-normal">Driver / Model</th>
                  <th className="py-2 pr-4 pl-2 font-normal text-right w-28">
                    {leaderboardMode === 0 ? 'Last / Gap' : 'Lap / INT'}
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
        <div className="absolute hidden md:flex top-20 right-margin-desktop z-10 flex flex-col gap-3">
          <div className="bg-surface-container-low/60 backdrop-blur-md rounded-full p-4 border border-white/10 shadow-lg pointer-events-none">
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
        {typeof window !== 'undefined' && localStorage.getItem('streamUrl') && localStorage.getItem('streamUrl').trim() !== '' && (
         <iframe
            src={localStorage.getItem('streamUrl')}
            title="Live Stream"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute bottom-10 hidden md:flex right-margin-desktop z-10 min-width-[30vw] w-[20vw] aspect-video bg-black/80 border border-white/10 rounded-full shadow-lg"
          ></iframe>
        )}
      </main>
        {/* Filter Buttons and Search Input */}
      <div className="hidden md:flex fixed top-5 right-margin-desktop justify-end z-20 items-center max-w-[50vw] bg-surface-container-low/60 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-lg">
        <div className="overflow-x-auto classbar-animation whitespace-nowrap flex gap-2 px-1">

        <div className="overflow-x-auto classbar-animation whitespace-nowrap flex gap-2 px-1">
      {filteredClasses.map(f => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`${
            filter === f 
            ? 'bg-secondary-container text-on-secondary-container shadow-[0_0_10px_rgba(195,244,0,0.2)]' 
            : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
            } px-2 py-1.5 rounded-full font-label-caps text-label-caps uppercase transition-colors`}
    >
      {f}
    </button>
  ))}
</div>
        </div>
        <div className="flex items-center">
          <input
            type="text"
            placeholder="Search Driver or #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface-container-low/60 focus:outline-none focus:ring-primary focus:border-primary backdrop-blur-md rounded-md h-8 border border-white/10 shadow-lg"
          />
        </div>

        {/* Add a button to show the popup with available classes */}
        <button
          onClick={() => setShowPopup(true)}
          className="text-primary hover:text-on-surface rounded-full hover:bg-white/5 ml-1 px-1 py-1"
        >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="size-6">
  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" />
  <path strokeLinecap="round" strokeLinejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008Z" />
</svg>
        </button>

      </div>
      
    </>
  );
}

export default App;
