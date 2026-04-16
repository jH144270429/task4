import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type CreateLocationInput = {
  name: string;
  country?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = body as Partial<CreateLocationInput>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const country =
    input.country == null
      ? null
      : typeof input.country === "string"
        ? input.country.trim() || null
        : null;
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const timezone =
    typeof input.timezone === "string" && input.timezone.trim()
      ? input.timezone.trim()
      : "auto";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { error: "latitude/longitude must be numbers" },
      { status: 400 }
    );
  }

  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const upsertResult = await supabase
    .from("locations")
    .upsert(
      { name, country, latitude, longitude, timezone },
      { onConflict: "name,country,latitude,longitude" }
    )
    .select("id,name,country,latitude,longitude,timezone,created_at")
    .limit(1)
    .maybeSingle();

  if (upsertResult.error) {
    return NextResponse.json(
      { error: upsertResult.error.message },
      { status: 500 }
    );
  }

  if (!upsertResult.data) {
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }

  return NextResponse.json({ location: upsertResult.data });
}
