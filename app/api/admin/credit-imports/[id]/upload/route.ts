import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth";
import { captureRaw, ImportRunnerError } from "@/lib/credit-import/runner";
import type { Id } from "@/convex/_generated/dataModel";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per spec
const ACCEPTED_TYPES = new Set([
  "application/json",
  "text/json",
  "application/x-json",
  "text/plain",
  "", // browsers sometimes omit the type for .json
]);

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "BAD_FORMDATA", message: "Request must be multipart/form-data." },
      { status: 400 },
    );
  }
  const file = form.get("file");
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
        message: `Unsupported file type '${file.type || "unknown"}'. Upload a .json file.`,
      },
      { status: 415 },
    );
  }

  let bodyText: string;
  try {
    bodyText = await file.text();
  } catch (err) {
    return NextResponse.json(
      { error: "READ_FAILED", message: (err as Error).message },
      { status: 400 },
    );
  }

  try {
    JSON.parse(bodyText);
  } catch (err) {
    return NextResponse.json(
      {
        error: "INVALID_JSON",
        message: `File is not valid JSON: ${(err as Error).message}`,
      },
      { status: 400 },
    );
  }

  try {
    const imp = await captureRaw(
      { token },
      { importId: id as Id<"creditReportImports">, bodyText },
    );
    return NextResponse.json({
      import: imp,
      file: { name: file.name, size: file.size, type: file.type || "application/json" },
    });
  } catch (err) {
    if (err instanceof ImportRunnerError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}
