import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { PreviewImportZ } from "@/lib/credit-import/schemas";
import { previewRaw } from "@/lib/credit-import/runner";
import type { CreditProvider } from "@/lib/credit-import/types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "application/json",
  "text/json",
  "application/x-json",
  "text/plain",
  "",
]);

async function isAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const u = await currentUser();
  if (!u) return false;
  const role =
    ((u.publicMetadata as { role?: string } | undefined)?.role as string | undefined) ??
    ((u.privateMetadata as { role?: string } | undefined)?.role as string | undefined);
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  // Path A: multipart upload — preview a pasted or uploaded file without DB writes.
  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(
        { error: "BAD_FORMDATA", message: "Invalid multipart request." },
        { status: 400 },
      );
    }
    const file = form.get("file");
    const provider = (form.get("provider") as string) || "IDENTITYIQ";
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "NO_FILE", message: "A 'file' part is required." },
        { status: 400 },
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: "FILE_TOO_LARGE",
          message: `Uploads are limited to ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
          maxBytes: MAX_UPLOAD_BYTES,
          actualBytes: file.size,
        },
        { status: 413 },
      );
    }
    if (!ACCEPTED_TYPES.has(file.type) && !file.name.toLowerCase().endsWith(".json")) {
      return NextResponse.json(
        {
          error: "BAD_MIME",
          message: `Unsupported file type '${file.type || "unknown"}'.`,
        },
        { status: 415 },
      );
    }
    const bodyText = await file.text();
    try {
      JSON.parse(bodyText);
    } catch (err) {
      return NextResponse.json(
        { error: "INVALID_JSON", message: (err as Error).message },
        { status: 400 },
      );
    }
    try {
      const out = await previewRaw({ provider: provider as CreditProvider, bodyText });
      return NextResponse.json(out);
    } catch (err) {
      return NextResponse.json(
        { error: "PREVIEW_FAILED", message: (err as Error).message },
        { status: 400 },
      );
    }
  }

  // Path B: JSON body (paste or direct JSON).
  const body = await req.json().catch(() => ({}));
  const parsed = PreviewImportZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const out = await previewRaw({
      provider: parsed.data.provider,
      bodyText: parsed.data.bodyText,
      json: parsed.data.json,
    });
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: "PREVIEW_FAILED", message: (err as Error).message },
      { status: 400 },
    );
  }
}
