import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { captureRaw, ImportRunnerError } from "@/lib/credit-import/runner";
import type { Id } from "@/convex/_generated/dataModel";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "application/json",
  "text/json",
  "application/x-json",
  "text/plain",
  "",
]);

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Params) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  const { id } = await ctx.params;

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
      },
      { status: 413 },
    );
  }
  if (!ACCEPTED_TYPES.has(file.type) && !file.name.toLowerCase().endsWith(".json")) {
    return NextResponse.json(
      { error: "BAD_MIME", message: "Upload a .json file." },
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
    const updated = await captureRaw(
      { token },
      {
        importId: id as Id<"creditReportImports">,
        bodyText,
        onlyIfOwnedByMe: true,
      },
    );
    return NextResponse.json({
      import: updated,
      file: { name: file.name, size: file.size, type: file.type || "application/json" },
    });
  } catch (err) {
    if (err instanceof ImportRunnerError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    if ((err as Error).message === "NOT_FOUND" || (err as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}
