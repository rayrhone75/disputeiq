import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Server-side rendered HTML preview only. Raw PDFs are NEVER returned to the
// client before payment + user confirmation. After PAID/MAILED/DELIVERED the
// preview drops the watermark but is still HTML — the actual mailing artifact
// stays in protected storage and is only handed to LetterStream.
async function render(disputeCaseId: string) {
  const dc = await prisma.disputeCase.findUnique({ where: { id: disputeCaseId } });
  if (!dc) return new NextResponse("Not found", { status: 404 });

  const paid = dc.status === "PAID" || dc.status === "MAILED" || dc.status === "DELIVERED";
  const watermark = paid ? "" : "UNPAID DRAFT";

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
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  return render(id);
}

export async function POST(req: NextRequest) {
  const { disputeCaseId } = await req.json();
  if (!disputeCaseId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  return render(disputeCaseId);
}
