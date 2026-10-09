import { NextRequest, NextResponse } from "next/server";
import { SupportedCurrency } from "@/lib/store";

export async function GET(request: NextRequest) {
  // Check common geo IP headers
  const countryHeader =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-country-code") ||
    request.headers.get("x-real-ip-country") ||
    "";

  const country = countryHeader.toUpperCase();
  let currency: SupportedCurrency = "USD";

  switch (country) {
    case "UG":
      currency = "UGX";
      break;
    case "KE":
      currency = "KES";
      break;
    case "NG":
      currency = "NGN";
      break;
    case "GB":
    case "UK":
      currency = "GBP";
      break;
    case "US":
    case "CA":
      currency = "USD";
      break;
    case "NL":
    case "DE":
    case "FR":
    case "ES":
    case "IT":
    case "SE":
    case "IE":
      currency = "EUR";
      break;
    default:
      currency = "USD";
      break;
  }

  return NextResponse.json({
    country: country || null,
    currency,
  });
}
