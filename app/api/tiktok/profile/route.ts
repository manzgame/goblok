import { NextResponse } from "next/server";
import { tikTokProfile } from "@/lib/providers/tiktok";
import type { TikTokProfileApiResponse } from "@/types/download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

function json(payload: TikTokProfileApiResponse, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

async function processUsername(value: unknown) {
  const username = typeof value === "string" ? value.trim() : "";
  const result = await tikTokProfile(username);
  if (!result.ok || !result.profile) return json({ success: false, error: result.error || "Profil gagal dimuat." }, result.status);
  return json({ success: true, profile: result.profile });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return processUsername(body?.username);
  } catch {
    return json({ success: false, error: "Permintaan profil tidak valid." }, 400);
  }
}

export async function GET(request: Request) {
  return processUsername(new URL(request.url).searchParams.get("username"));
}
