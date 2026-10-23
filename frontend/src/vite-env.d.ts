/// <reference types="vite/client" />

declare module 'react-simple-maps' {
  import * as React from 'react';

  export interface ComposableMapProps extends React.SVGProps<SVGSVGElement> {
    projection?: string | ((...args: unknown[]) => unknown);
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    children?: React.ReactNode;
  }

  export const ComposableMap: React.FC<ComposableMapProps>;
  export const ZoomableGroup: React.FC<{
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    children?: React.ReactNode;
  }>;
  export const Geographies: React.FC<{
    geography: string | Record<string, unknown>;
    children: (data: { geographies: Array<{ rsmKey: string; [key: string]: unknown }> }) => React.ReactNode;
  }>;
  export const Geography: React.FC<{
    geography: Record<string, unknown>;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: Record<string, React.CSSProperties>;
  }>;
  export const Marker: React.FC<{
    coordinates: [number, number];
    onClick?: () => void;
    children?: React.ReactNode;
  }>;
}
