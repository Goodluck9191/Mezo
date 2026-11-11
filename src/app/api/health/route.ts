import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness check. Intentionally does not touch the database or expose
 * configuration; a future readiness endpoint can verify dependencies.
 */
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "mezo",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
