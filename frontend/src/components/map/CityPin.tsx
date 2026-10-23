import React, { useState } from 'react';
import { Marker } from 'react-simple-maps';

export interface CityPinData {
  id: string | number;
  name: string;
  city: string;
  country?: string;
  countryCode: string;
  flagEmoji?: string;
  coordinates: [number, number]; // [lng, lat]
  feedId: number;
  odds?: number;
  status?: string;
}

export interface CityPinProps {
  lat?: number;
  long?: number;
  cityName?: string;
  countryFlag?: string;
  countryName?: string;
  odds?: number;
  pin?: CityPinData;
  isSelected?: boolean;
  onSelect?: (feedId: number, pin?: CityPinData) => void;
  onHoverChange?: (hovered: boolean) => void;
}

/**
 * Custom SVG City Pin with hover animation, gold glow & interactive tooltip
 */
export const CityPin: React.FC<CityPinProps> = ({
  lat,
  long,
  cityName,
  countryFlag,
  countryName,
  odds,
  pin,
  isSelected = false,
  onSelect,
  onHoverChange,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const coordinates: [number, number] = pin?.coordinates || [long ?? 0, lat ?? 0];
  const resolvedCity = cityName || pin?.city || pin?.name || 'City';
  const resolvedCountry = countryName || pin?.country || pin?.countryCode || '';
  const resolvedFlag = countryFlag || pin?.flagEmoji || '📍';
  const resolvedFeedId = pin?.feedId ?? 1;
  const resolvedOdds = odds ?? pin?.odds;

  const active = isSelected || isHovered;

  return (
    <Marker
      coordinates={coordinates}
      onClick={() => onSelect?.(resolvedFeedId, pin)}
    >
      <g
        onMouseEnter={() => {
          setIsHovered(true);
          onHoverChange?.(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          onHoverChange?.(false);
        }}
        className="cursor-pointer transition-transform duration-200"
        style={{
          transform: isHovered ? 'scale(1.22)' : isSelected ? 'scale(1.12)' : 'scale(1)',
        }}
      >
        {/* Outer pulsing gold halo */}
        <circle
          r={active ? 13 : 9}
          fill={isSelected ? 'rgba(255, 215, 0, 0.35)' : 'rgba(255, 215, 0, 0.18)'}
          className="animate-ping"
        />

        {/* Secondary glow ring */}
        <circle
          r={active ? 9 : 6.5}
          fill={isSelected ? 'rgba(255, 215, 0, 0.25)' : 'rgba(255, 215, 0, 0.12)'}
          stroke="#FFD700"
          strokeWidth={active ? 1.2 : 0.6}
          strokeOpacity={active ? 0.9 : 0.45}
        />

        {/* Core gold circle pin */}
        <circle
          r={active ? 5.5 : 4.2}
          fill={isSelected ? '#FFD700' : isHovered ? '#FFE55C' : '#FFD700'}
          stroke="#0f0f0f"
          strokeWidth={1.6}
        />

        {/* Inner dark center dot */}
        <circle r={1.6} fill="#0f0f0f" />

        {/* City name label below pin */}
        <text
          textAnchor="middle"
          y={15}
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: active ? '9.5px' : '8.5px',
            fontWeight: 800,
            fill: isSelected ? '#FFD700' : '#F3F4F6',
            paintOrder: 'stroke',
            stroke: '#0f0f0f',
            strokeWidth: '3px',
            pointerEvents: 'none',
          }}
        >
          {resolvedCity}
        </text>

        {/* Hover / Selected Tooltip above pin */}
        {isHovered && (
          <g transform="translate(0, -26)" style={{ pointerEvents: 'none' }}>
            <rect
              x={-68}
              y={-22}
              width={136}
              height={24}
              rx={6}
              fill="#0f0f0f"
              stroke="#FFD700"
              strokeWidth={1}
              opacity={0.96}
            />
            <text
              textAnchor="middle"
              y={-7}
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '8.5px',
                fontWeight: 700,
                fill: '#FFFFFF',
              }}
            >
              {`${resolvedFlag} ${resolvedCity}${resolvedCountry ? `, ${resolvedCountry}` : ''}${
                resolvedOdds ? ` • x${resolvedOdds.toFixed(1)}` : ''
              }`}
            </text>
          </g>
        )}
      </g>
    </Marker>
  );
};

export default CityPin;
