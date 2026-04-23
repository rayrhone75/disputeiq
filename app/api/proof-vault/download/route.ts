import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { storage } from "@/lib/storage";

// Streams a vault attachment to the owner. Ownership is enforced via the
// disputeCase → userId join. We never expose raw storage refs on the client.
export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const attachment = await prisma.caseAttachment.findUnique({
    where: { id },
    include: { disputeCase: true },
  });
  if (!attachment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (attachment.disputeCase.userId !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const buf = await storage.get(attachment.secureFileRef);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${attachment.kind.toLowerCase()}-${id.slice(0, 8)}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "STORAGE_ERROR" }, { status: 500 });
  }
}
