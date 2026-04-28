import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { storage } from "@/lib/storage";

// Streams a vault attachment to the owner. Ownership is enforced via the
// Convex `proofVault.getAttachmentForCurrentUser` query, which checks
// `disputeCase.userId === currentUser._id`. We never expose raw storage refs
// on the client.
export async function GET(req: NextRequest) {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  let attachment;
  try {
    attachment = await fetchQuery(
      api.proofVault.getAttachmentForCurrentUser,
      { attachmentId: id as Id<"caseAttachments"> },
      { token },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (msg.includes("UNAUTHENTICATED") || msg.includes("USER_NOT_MIRRORED")) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (!attachment) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
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
