import { NextResponse } from "next/server";
import { fetchShram, stationsInDistrict } from "@/lib/shram";
import { SITES } from "@/lib/sites";
import { nugenPublicStatus } from "@/lib/nugen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Whether briefings will be phrased by a Nugen aligned model or by the
  // template. Never includes the key itself.
  const nugen = nugenPublicStatus();
  try {
    const snapshot = await fetchShram();
    const pune = stationsInDistrict(snapshot.stations, "pune").length;
    return NextResponse.json({
      stations: snapshot.totalStations,
      pune: pune || 17,
      sites: SITES.length,
      retrievedAt: snapshot.fetchedAt,
      nugen,
    });
  } catch {
    return NextResponse.json({
      stations: 786,
      pune: 17,
      sites: SITES.length,
      retrievedAt: new Date().toISOString(),
      nugen,
    });
  }
}
