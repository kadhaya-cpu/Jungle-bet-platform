import React from 'react';
import { Marker } from 'react-simple-maps';

export interface CityPinData {
  id: string | number;
  name: string;
  city: string;
  countryCode: string;
  coordinates: [number, number]; // [lng, lat]
  feedId: number;
  status?: string;
}

export interface CityPinProps {
  pin: CityPinData;
  isSelected?: boolean;
  onSelect: (feedId: number, pin: CityPinData) => void;
}

/**
 * Interactive City Telemetry Pin for the Europe / Global Camera Map
 */
export const CityPin: React.FC<CityPinProps> = ({
  pin,
  isSelected = false,
  onSelect,
}) => {
  return (
    <Marker
      coordinates={pin.coordinates}
      onClick={() => onSelect(pin.feedId, pin)}
    >
      <g className="cursor-pointer group">
        {/* Outer pulse ring */}
        <circle
          r={isSelected ? 12 : 8}
          fill={isSelected ? 'rgba(255, 215, 0, 0.35)' : 'rgba(16, 185, 129, 0.25)'}
          className="animate-ping"
        />
        {/* Core pin circle */}
        <circle
          r={isSelected ? 6 : 4.5}
          fill={isSelected ? '#FFD700' : '#10B981'}
          stroke="#0f0f0f"
          strokeWidth={1.5}
        />
        {/* Label pill */}
        <text
          textAnchor="middle"
          y={-12}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: isSelected ? '10px' : '9px',
            fontWeight: 700,
            fill: isSelected ? '#FFD700' : '#E5E7EB',
            paintOrder: 'stroke',
            stroke: '#0f0f0f',
            strokeWidth: '3px',
          }}
        >
          {pin.city}
        </text>
      </g>
    </Marker>
  );
};

export default CityPin;
