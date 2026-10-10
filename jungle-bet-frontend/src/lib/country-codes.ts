export interface CountryCodeItem {
  name: string;
  code: string;
  flag: string;
}

export const COUNTRY_CODES: CountryCodeItem[] = [
  { name: "Uganda", code: "+256", flag: "🇺🇬" },
  { name: "Kenya", code: "+254", flag: "🇰🇪" },
  { name: "Tanzania", code: "+255", flag: "🇹🇿" },
  { name: "Rwanda", code: "+250", flag: "🇷🇼" },
  { name: "Nigeria", code: "+234", flag: "🇳🇬" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "United States", code: "+1", flag: "🇺🇸" },
];

export const DEFAULT_COUNTRY_CODE = "+256";
