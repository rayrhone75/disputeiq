import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureRaw, ImportRunnerError } from "@/lib/credit-import/runner";

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
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;

  const imp = await prisma.creditReportImport.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!imp) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

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
    const updated = await captureRaw({ importId: id, bodyText, actorUserId: user.id });
    return NextResponse.json({
      import: updated,
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
