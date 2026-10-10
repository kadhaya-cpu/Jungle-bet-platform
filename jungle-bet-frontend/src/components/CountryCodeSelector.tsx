"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { COUNTRY_CODES, CountryCodeItem, DEFAULT_COUNTRY_CODE } from "@/lib/country-codes";

interface CountryCodeSelectorProps {
  value: string;
  onChange: (code: string) => void;
}

export default function CountryCodeSelector({
  value = DEFAULT_COUNTRY_CODE,
  onChange,
}: CountryCodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem =
    COUNTRY_CODES.find((c) => c.code === value) || COUNTRY_CODES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#1e293b] hover:bg-[#283548] text-white border-0 transition-all cursor-pointer text-xs font-mono font-bold focus:outline-none"
        aria-label="Select Country Code"
        aria-expanded={isOpen}
      >
        <span className="text-base leading-none">{selectedItem.flag}</span>
        <span className="tracking-wide text-gray-200">{selectedItem.code}</span>
        <ChevronDown
          size={13}
          className={`text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-teal-400" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-52 rounded-2xl bg-[#0f172a] border border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.6)] p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 mb-1 border-b border-white/10 text-[10px] font-mono uppercase text-gray-400 font-bold">
            Select Country
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5 no-scrollbar">
            {COUNTRY_CODES.map((item) => {
              const isSelected = item.code === value;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onChange(item.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? "bg-teal-500/20 text-teal-300 font-bold"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.flag}</span>
                    <span className="font-sans text-xs">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-gray-400">{item.code}</span>
                    {isSelected && <Check size={13} className="text-teal-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
