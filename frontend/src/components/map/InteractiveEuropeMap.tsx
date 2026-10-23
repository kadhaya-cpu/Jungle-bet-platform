import React, { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { geoMercator } from 'd3-geo';
import { MapPin, Compass, Radio, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { CameraFeedGame, useBettingStore } from '../../store/useBettingStore';
import { EUROPE_CITIES, CityData } from '../../utils/cityData';
import { CityPin, CityPinData } from './CityPin';

const GEO_URL = '/world-110m.json';

export interface InteractiveEuropeMapProps {
  feeds?: CameraFeedGame[];
  onSelectFeed?: (feedId: number) => void;
  onSelectCity?: (city: CityData) => void;
}

/**
 * Interactive Europe Map powered by react-simple-maps + d3-geo
 * Renders clickable gold pins across 8 major European cities:
 * London, Paris, Berlin, Rome, Amsterdam, Madrid, Vienna, Prague
 */
export const InteractiveEuropeMap: React.FC<InteractiveEuropeMapProps> = ({
  feeds = [],
  onSelectFeed,
  onSelectCity,
}) => {
  const { selectedCity, selectedFeedId, activeGames, selectCity, setSelectedFeedId } =
    useBettingStore();

  const [hoveredCity, setHoveredCity] = useState<CityData | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [center, setCenter] = useState<[number, number]>([8, 49.5]);

  const projectionConfig = useMemo(() => {
    const proj = geoMercator().center([8, 49.5]).scale(680);
    return {
      center: proj.center() as [number, number],
      scale: proj.scale(),
    };
  }, []);

  const gameList = feeds.length > 0 ? feeds : activeGames;

  const pins = useMemo(() => {
    return EUROPE_CITIES.map((city) => {
      const matchedGame = gameList.find(
        (g) =>
          g.cityId === city.id ||
          g.id === city.feedId ||
          g.cityName?.toLowerCase() === city.name.toLowerCase()
      );
      const pinData: CityPinData = {
        id: city.id,
        name: matchedGame?.name || `${city.name} Live Cam`,
        city: city.name,
        country: city.country,
        countryCode: city.countryCode,
        flagEmoji: city.flagEmoji,
        coordinates: [city.long, city.lat],
        feedId: matchedGame?.id || city.feedId,
        odds: matchedGame?.odds || 2.5,
        status: matchedGame?.status || 'ACTIVE',
      };
      return { city, pinData };
    });
  }, [gameList]);

  const handleCitySelection = (city: CityData, feedId: number) => {
    selectCity(city);
    setSelectedFeedId(feedId);
    onSelectCity?.(city);
    onSelectFeed?.(feedId);
  };

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 overflow-hidden shadow-xl flex flex-col h-full">
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-[#141414] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#FFD700]" />
          <h3 className="text-sm font-extrabold text-white tracking-tight">
            Interactive Europe Live Traffic Map
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
            {EUROPE_CITIES.length} European Hubs
          </span>
        </div>
      </div>

      {/* Interactive Vector Map Canvas */}
      <div className="relative flex-1 min-h-[340px] sm:min-h-[380px] w-full bg-[#0f0f0f] overflow-hidden">
        {/* Subtle radial gold glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,215,0,0.06),transparent_70%)] pointer-events-none" />

        {/* Map Zoom Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z * 1.3, 4))}
            title="Zoom in"
            className="p-2 rounded-xl bg-[#1a1a1a]/90 hover:bg-[#252525] text-gray-200 hover:text-[#FFD700] border border-white/10 transition-colors shadow-lg"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z / 1.3, 1))}
            title="Zoom out"
            className="p-2 rounded-xl bg-[#1a1a1a]/90 hover:bg-[#252525] text-gray-200 hover:text-[#FFD700] border border-white/10 transition-colors shadow-lg"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setCenter([8, 49.5]);
            }}
            title="Reset map view"
            className="p-2 rounded-xl bg-[#1a1a1a]/90 hover:bg-[#252525] text-gray-200 hover:text-[#FFD700] border border-white/10 transition-colors shadow-lg"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Active/Hovered City Info Badge */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          {hoveredCity ? (
            <div className="bg-[#1a1a1a]/95 backdrop-blur-md border border-[#FFD700]/60 rounded-xl px-3.5 py-2 shadow-xl transition-all">
              <div className="flex items-center gap-2">
                <span className="text-base">{hoveredCity.flagEmoji}</span>
                <div>
                  <div className="text-xs font-extrabold text-white">
                    {hoveredCity.name}, <span className="text-[#FFD700]">{hoveredCity.country}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">{hoveredCity.corridorName}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1a1a1a]/85 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-base">{selectedCity.flagEmoji}</span>
                <div>
                  <div className="text-xs font-bold text-white">
                    Selected: <span className="text-[#FFD700]">{selectedCity.name}</span> (
                    {selectedCity.country})
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Click any gold pin to switch live camera stream
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <ComposableMap
          projection="geoMercator"
          projectionConfig={projectionConfig}
          className="w-full h-full"
        >
          <ZoomableGroup center={center} zoom={zoom}>
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: Array<{ rsmKey: string }> }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#181b22"
                    stroke="#2b313e"
                    strokeWidth={0.55}
                    style={{
                      default: { outline: 'none', transition: 'fill 200ms ease' },
                      hover: { fill: '#232834', outline: 'none' },
                      pressed: { fill: '#2a3040', outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>

            {pins.map(({ city, pinData }) => {
              const isSelected =
                selectedCity.id === city.id || selectedFeedId === pinData.feedId;
              return (
                <CityPin
                  key={city.id}
                  lat={city.lat}
                  long={city.long}
                  cityName={city.name}
                  countryFlag={city.flagEmoji}
                  countryName={city.country}
                  odds={pinData.odds}
                  pin={pinData}
                  isSelected={isSelected}
                  onSelect={() => handleCitySelection(city, pinData.feedId)}
                  onHoverChange={(hovered) => setHoveredCity(hovered ? city : null)}
                />
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {/* Bottom Quick-Select City Pills Bar */}
        <div className="absolute bottom-3 left-3 right-3 bg-[#141414]/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-gray-300 font-semibold">
            <MapPin className="w-3.5 h-3.5 text-[#FFD700] shrink-0" />
            <span className="hidden sm:inline">Cities:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {pins.map(({ city, pinData }) => {
              const isSelected =
                selectedCity.id === city.id || selectedFeedId === pinData.feedId;
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleCitySelection(city, pinData.feedId)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#FFD700] text-[#0f0f0f] shadow-[0_0_12px_rgba(255,215,0,0.4)]'
                      : 'bg-white/5 text-gray-300 hover:bg-white/15 hover:text-white border border-white/5'
                  }`}
                >
                  <span>{city.flagEmoji}</span>
                  <span>{city.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveEuropeMap;
