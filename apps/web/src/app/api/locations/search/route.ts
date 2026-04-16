import { NextResponse } from "next/server";

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const apiUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  apiUrl.searchParams.set("name", q);
  apiUrl.searchParams.set("count", "10");
  apiUrl.searchParams.set("language", "en");
  apiUrl.searchParams.set("format", "json");

  const response = await fetch(apiUrl.toString(), {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Geocoding request failed: ${response.status}` },
      { status: 502 }
    );
  }

  const json = (await response.json()) as { results?: GeocodingResult[] };
  const results = (json.results ?? []).map((r) => ({
    name: r.name,
    country: r.country ?? null,
    admin1: r.admin1 ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? "auto",
  }));

  return NextResponse.json({ results });
}

