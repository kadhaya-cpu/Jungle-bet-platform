import React, { useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { geoMercator } from 'd3-geo';
import { MapPin, Compass, Radio } from 'lucide-react';
import { CameraFeedGame, useBettingStore } from '../../store/useBettingStore';
import { CityPin, CityPinData } from './CityPin';

const GEO_URL = '/world-110m.json';

/**
 * Coordinates resolver for backend camera feeds (London, Amsterdam, etc.)
 * Ready for expanding European city junctions dynamically from backend API.
 */
const FEED_COORDINATE_LOOKUP: Record<string, [number, number]> = {
  UK: [-0.1508, 51.4842], // London - Chelsea Bridge
  GB: [-0.1508, 51.4842],
  NL: [4.9041, 52.3676], // Amsterdam - A10 / A1
  US: [-3.7038, 40.4168], // Displayed on Europe projection gateway pin
  SIM: [2.3522, 48.8566], // Paris Optical Simulation Hub
};

export interface InteractiveEuropeMapProps {
  feeds?: CameraFeedGame[];
  onSelectFeed?: (feedId: number) => void;
}

/**
 * Interactive Europe Map powered by react-simple-maps + d3-geo
 * Displays active backend camera feeds and acts as the extensible Europe hub.
 */
export const InteractiveEuropeMap: React.FC<InteractiveEuropeMapProps> = ({
  feeds = [],
  onSelectFeed,
}) => {
  const { selectedFeedId, setSelectedFeedId } = useBettingStore();

  // Verify d3-geo projection configuration
  const projectionConfig = useMemo(() => {
    const proj = geoMercator().center([8, 50]).scale(620);
    return {
      center: proj.center() as [number, number],
      scale: proj.scale(),
    };
  }, []);

  const pins: CityPinData[] = useMemo(() => {
    return feeds.map((f, index) => {
      const coords = FEED_COORDINATE_LOOKUP[f.country_code] || [
        4.0 + index * 4.5,
        48.5 + index * 1.5,
      ];
      return {
        id: f.id,
        name: f.name,
        city: f.location.split('-')[0].trim(),
        countryCode: f.country_code,
        coordinates: coords,
        feedId: f.id,
        status: f.status,
      };
    });
  }, [feeds]);

  const handlePinSelect = (feedId: number) => {
    setSelectedFeedId(feedId);
    onSelectFeed?.(feedId);
  };

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 overflow-hidden">
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#FFD700]" />
          <h3 className="text-sm font-bold text-white">
            Interactive Europe Optical Telemetry Map
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
            <Radio className="w-3 h-3 animate-pulse" />
            {pins.length} Active Feed Nodes
          </span>
          <span className="text-gray-600">•</span>
          <span>Click any city pin to switch live camera</span>
        </div>
      </div>

      {/* Vector Map Canvas */}
      <div className="relative h-72 sm:h-80 w-full bg-[#111318]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={projectionConfig}
          className="w-full h-full"
        >
          <ZoomableGroup center={[8, 50]} zoom={1}>
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: Array<{ rsmKey: string }> }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#1f2430"
                    stroke="#2e3646"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { fill: '#2a3142', outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>

            {pins.map((pin) => (
              <CityPin
                key={pin.id}
                pin={pin}
                isSelected={pin.feedId === selectedFeedId}
                onSelect={handlePinSelect}
              />
            ))}
          </ZoomableGroup>
        </ComposableMap>

        {/* Bottom Overlay Legend & City Expansion Hook */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 bg-[#0f0f0f]/85 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            <MapPin className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>
              European Traffic Corridors Ready (London, Amsterdam & upcoming EU nodes)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {pins.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePinSelect(p.feedId)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  p.feedId === selectedFeedId
                    ? 'bg-[#FFD700] text-[#0f0f0f]'
                    : 'bg-white/10 text-gray-300 hover:text-white'
                }`}
              >
                {p.city}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveEuropeMap;
