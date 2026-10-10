"use client";

import React from "react";
import InteractiveEuropeMap, { InteractiveEuropeMapProps } from "./InteractiveEuropeMap";
import { EuropeanCity } from "@/lib/european-cities";

export interface EuropeMapProps {
  selectedCity: EuropeanCity;
  onSelectCity: (city: EuropeanCity) => void;
  className?: string;
}

export default function EuropeMap({
  selectedCity,
  onSelectCity,
  className = "",
}: EuropeMapProps) {
  return (
    <InteractiveEuropeMap
      selectedCity={selectedCity}
      onSelectCity={onSelectCity}
      className={className}
    />
  );
}

export { InteractiveEuropeMap };
