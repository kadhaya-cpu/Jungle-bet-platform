"use client";

import React, { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { CITY_FEEDS, CityFeed } from "@/data/cityFeeds";
import {
  Radio,
  MapPin,
  Compass,
  Activity,
  Tv,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";

// Static TopoJSON file downloaded locally in public/
const GEO_URL = "/world-110m.json";

export interface InteractiveEuropeMapProps {
  selectedCity?: CityFeed;
  onSelectCity?: (city: CityFeed) => void;
  className?: string;
}

export default function InteractiveEuropeMap({
  selectedCity: propSelectedCity,
  onSelectCity,
  className = "",
}: InteractiveEuropeMapProps) {
  // Global selectedCity state from Zustand store
  const storeSelectedCity = useStore((state) => state.selectedCity);
  const setStoreSelectedCity = useStore((state) => state.setSelectedCity);

  // Active city resolution (prop overrides or falls back to global store)
  const activeCity: CityFeed =
    propSelectedCity || storeSelectedCity || CITY_FEEDS[0];

  // Hover state for interactive tooltips
  const [hoveredCity, setHoveredCity] = useState<CityFeed | null>(null);

  // Click handler: updates global state and triggers the video player to load that city's feed
  const handleCitySelect = (city: CityFeed) => {
    setStoreSelectedCity(city);
    onSelectCity?.(city);
    toast.success(`Loaded YouTube live stream: ${city.cityName} (${city.country})`);
  };

  return (
    <div
      className={`relative w-full rounded-2xl bg-[#0f172a] border border-white/10 overflow-hidden shadow-2xl shadow-blue-500/10 flex flex-col transition-all duration-300 ${className}`}
      data-testid="interactive-europe-map-container"
    >
      {/* ------------------------------------------------------------- */}
      {/* MAP HEADER / TELEMETRY STATUS BAR                             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-white/10 select-none z-20">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400 text-[10px] font-mono font-bold tracking-wider uppercase shadow-sm">
            <Radio size={12} className="animate-pulse" />
            <span>EUROPE LIVE RADAR</span>
          </div>
          <span className="text-xs font-black text-white uppercase tracking-wider hidden sm:inline font-heading">
            Interactive City Feed Switcher
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
            <Compass size={12} className="text-teal-400" />
            <span className="text-white font-bold">{activeCity.cityName}</span>
            <span className="text-slate-400 hidden md:inline">
              ({activeCity.coordinates.lat.toFixed(2)}°N, {activeCity.coordinates.lng.toFixed(2)}°E)
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-teal-400 bg-[#0f172a] px-2.5 py-1 rounded-lg border border-teal-500/20 shadow-inner">
            <Activity size={10} />
            <span>{CITY_FEEDS.length} CITIES ONLINE</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* QUICK CITY SELECTOR TABS                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="px-3 py-2.5 bg-[#0f172a] border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar select-none z-20">
        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest shrink-0 mr-1 hidden sm:inline">
          CITIES:
        </span>
        {CITY_FEEDS.map((city) => {
          const isSelected = city.id === activeCity.id;
          return (
            <button
              key={city.id}
              onClick={() => handleCitySelect(city)}
              onMouseEnter={() => setHoveredCity(city)}
              onMouseLeave={() => setHoveredCity(null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 shrink-0 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 shadow-sm ${
                isSelected
                  ? "bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/20 scale-102"
                  : "bg-[#1e293b] hover:bg-[#334155] text-slate-300 hover:text-white border border-white/5"
              }`}
              data-testid={`city-tab-${city.cityName.toLowerCase()}`}
            >
              <span>{city.flag}</span>
              <span>{city.cityName}</span>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SVG INTERACTIVE EUROPE MAP STAGE                              */}
      {/* ------------------------------------------------------------- */}
      <div className="relative w-full aspect-[16/9] min-h-[300px] max-h-[480px] bg-[#0f172a] overflow-hidden select-none">
        {/* RADAR BACKGROUND GRID & CONCENTRIC RINGS */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(#14b8a6_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-[#00e5b9]/30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] rounded-full border border-[#00e5b9]/20" />
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00e5b9]/25 to-transparent" />
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-[#00e5b9]/25 to-transparent" />
        </div>

        {/* REACT-SIMPLE-MAPS SVG EUROPE MAP */}
        <ComposableMap
          projection="geoAzimuthalEqualArea"
          projectionConfig={{
            rotate: [-10.0, -52.0, 0],
            scale: 960,
          }}
          width={800}
          height={600}
          className="w-full h-full object-cover"
        >
          {/* Subtle Europe Country Geographies */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#111a2e"
                  stroke="#1e2d4a"
                  strokeWidth={0.6}
                  className="fill-[#111a2e] stroke-[#1e2d4a] hover:fill-[#1a2742] transition-colors duration-150 outline-none cursor-default"
                />
              ))
            }
          </Geographies>

          {/* City Markers plotted using coordinates: [lng, lat] */}
          {CITY_FEEDS.map((city) => {
            const isSelected = city.id === activeCity.id;
            const isHovered = hoveredCity?.id === city.id;

            return (
              <Marker
                key={city.id}
                coordinates={[city.coordinates.lng, city.coordinates.lat]}
                onClick={() => handleCitySelect(city)}
                onMouseEnter={() => setHoveredCity(city)}
                onMouseLeave={() => setHoveredCity(null)}
                className="cursor-pointer outline-none transition-transform"
              >
                {/* Ping animation ripple for selected city pin */}
                {isSelected && (
                  <circle
                    r={18}
                    fill="none"
                    stroke="#00e5b9"
                    strokeWidth={1.8}
                    className="animate-ping opacity-75 origin-center"
                  />
                )}

                {/* Outer halo beacon ring */}
                <circle
                  r={isSelected ? 10 : isHovered ? 8 : 6}
                  fill={isSelected ? "#00e5b9" : isHovered ? "#38bdf8" : "#00e5b9"}
                  fillOpacity={isSelected ? 0.35 : isHovered ? 0.25 : 0.15}
                  stroke={isSelected ? "#00e5b9" : isHovered ? "#38bdf8" : "#00e5b9"}
                  strokeWidth={isSelected ? 2 : 1.2}
                />

                {/* Glowing pin core */}
                <circle
                  r={isSelected ? 4.5 : isHovered ? 4 : 3}
                  fill={isSelected ? "#ffffff" : isHovered ? "#38bdf8" : "#00e5b9"}
                  stroke={isSelected ? "#00e5b9" : "#0f172a"}
                  strokeWidth={1}
                />

                {/* City name text label on the map */}
                <text
                  textAnchor="middle"
                  y={isSelected ? -14 : -10}
                  className="font-mono font-bold tracking-wider select-none pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                  fill={isSelected ? "#00e5b9" : isHovered ? "#ffffff" : "#94a3b8"}
                  fontSize={isSelected ? 11 : 9}
                >
                  {city.cityName}
                </text>
              </Marker>
            );
          })}
        </ComposableMap>

        {/* ----------------------------------------------------------- */}
        {/* FLOATING HOVER TOOLTIP                                       */}
        {/* ----------------------------------------------------------- */}
        <AnimatePresence>
          {hoveredCity && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-xs p-3 rounded-xl bg-[#090d16]/95 backdrop-blur-md border border-[#00e5b9]/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-30 pointer-events-none"
              data-testid="europe-map-tooltip"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{hoveredCity.flag}</span>
                  <span className="font-black text-xs text-white uppercase tracking-wider">
                    {hoveredCity.cityName}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    ({hoveredCity.country})
                  </span>
                </div>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>YOUTUBE LIVE</span>
                </div>
              </div>

              <div className="text-[11px] text-gray-300 font-medium mb-1.5 line-clamp-1">
                {hoveredCity.junction}
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-[10px] font-mono">
                <span className="text-[#00e5b9] font-bold">
                  Speed: ~{hoveredCity.opticalSettings.averageSpeedKmh} km/h
                </span>
                <span className="text-gray-400">Click to switch stream</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAP FOOTER: CURRENT STREAM TELEMETRY                          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-2 bg-[#090d16] border-t border-white/5 text-[11px] font-mono text-gray-400">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold">ACTIVE FEED:</span>
          <span className="text-[#00e5b9] font-bold">
            {activeCity.flag} {activeCity.cityName} — {activeCity.junction}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-gray-400">
            Density: <strong className="text-white">{activeCity.opticalSettings.trafficDensity}</strong>
          </span>
          <span className="text-gray-400">
            YouTube ID: <strong className="text-[#00e5b9]">{activeCity.youtubeVideoId}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
