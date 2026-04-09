import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Server-side rendered HTML preview only. Raw PDFs are NEVER returned to the
// client — even after payment. The mailable artifact stays in secure storage
// and is only handed to LetterStream. The visible UNPAID DRAFT watermark is
// part of the black-box model: there is no free, usable letter output.
async function render(disputeCaseId: string, userId: string) {
  const dc = await prisma.disputeCase.findUnique({ where: { id: disputeCaseId } });
  if (!dc) return new NextResponse("Not found", { status: 404 });
  if (dc.userId !== userId) return new NextResponse("Forbidden", { status: 403 });

  // Always watermark — the preview is never a usable artifact, regardless of state.
  const { DRAFT_WATERMARK } = await import("@/lib/watermark");
  const watermark = DRAFT_WATERMARK;

  const html = `<!doctype html><html><body style="font-family:Arial;padding:40px;position:relative;">
    ${watermark ? `<div style="opacity:.12;transform:rotate(-18deg);position:fixed;top:40%;left:18%;font-size:64px;">${watermark}</div>` : ""}
    <h1>${dc.letterType.replace(/_/g, " ")}</h1>
    <p><strong>Case:</strong> ${dc.id}</p>
    <p><strong>Basis:</strong> ${dc.aiReasonSummary}</p>
    <p>This is a protected preview. The final mailing packet is generated only after payment and explicit user confirmation.</p>
  </body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  return render(id, user.id);
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { disputeCaseId } = await req.json();
  if (!disputeCaseId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  return render(disputeCaseId, user.id);
}
