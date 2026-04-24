import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Server-side rendered HTML preview only. Raw PDFs are NEVER returned to the
// client — even after payment. The mailable artifact stays in secure storage
// and is only handed to LetterStream. The visible UNPAID DRAFT watermark is
// part of the black-box model: there is no free, usable letter output.
async function render(disputeCaseId: string, token: string) {
  const bundle = await fetchQuery(
    api.disputes.getById,
    { id: disputeCaseId as Id<"disputeCases"> },
    { token },
  );
  if (!bundle) return new NextResponse("Not found", { status: 404 });
  const dc = bundle.case;

  // Always watermark — the preview is never a usable artifact, regardless of state.
  const { DRAFT_WATERMARK } = await import("@/lib/watermark");
  const watermark = DRAFT_WATERMARK;

  const html = `<!doctype html><html><body style="font-family:Arial;padding:40px;position:relative;">
    ${watermark ? `<div style="opacity:.12;transform:rotate(-18deg);position:fixed;top:40%;left:18%;font-size:64px;">${watermark}</div>` : ""}
    <h1>${dc.letterType.replace(/_/g, " ")}</h1>
    <p><strong>Case:</strong> ${dc._id}</p>
    <p><strong>Basis:</strong> ${dc.aiReasonSummary}</p>
    <p>This is a protected preview. The final mailing packet is generated only after payment and explicit user confirmation.</p>
  </body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  return render(id, token);
}

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { disputeCaseId } = await req.json();
  if (!disputeCaseId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  return render(disputeCaseId, token);
}
