import { NextRequest, NextResponse } from "next/server";
import { getSettings, toSettingsDTO } from "@/lib/data";
import { addDays, today } from "@/lib/format";
import { binNames, binsOn } from "@/lib/bins";
import { notify, pushConfigured } from "@/lib/push";

/**
 * The evening before bin day, run once a day by Vercel Cron (vercel.json):
 * both phones hear which bins go out tonight.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  if (!pushConfigured()) return NextResponse.json({ ok: true, sent: false });

  const { bins } = toSettingsDTO(await getSettings());
  const out = binsOn(bins, addDays(today(), 1));
  if (!out.length) return NextResponse.json({ ok: true, sent: false });
  await notify(
    {
      title: "Bins out tonight",
      body: `${binNames(out)} ${out.length === 1 ? "goes" : "go"} out for tomorrow.`,
      url: "/",
      tag: "bins",
    },
    "everyone",
  );
  return NextResponse.json({ ok: true, sent: true });
}
