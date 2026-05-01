import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import manifest from "@/extension/manifest.json";
import { writeAuditLog } from "@/lib/audit";

// GET /api/extension/download — serves the prebuilt Connector .zip
// from `public/downloads/`. Sits in front of the static file so we get:
//   - `Content-Disposition: attachment` (forces "save as" instead of
//     opening inline, which matters because some browsers will try to
//     unzip Manifest V3 packages on click).
//   - An audit-log entry when a logged-in user kicks off a download —
//     gives us a real signal on extension uptake.
//   - One source of truth for the version: the `version` baked into
//     `extension/manifest.json` flows through to the file name and the
//     suggested-filename header. Bumping the manifest is the only step.
//
// Public-by-design: customers may share the download link with
// teammates before signing in. The actual API auth happens at pairing
// time via `/api/extension/pair/{start,complete}`.

export const dynamic = "force-dynamic";

const ZIP_BASENAME = `disputeiq-connector-v${manifest.version}.zip`;

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "public",
    "downloads",
    ZIP_BASENAME,
  );

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(filePath);
  } catch (err) {
    return NextResponse.json(
      {
        error: "ZIP_NOT_FOUND",
        message: `Build artifact missing: ${ZIP_BASENAME}. Run \`npm run extension:zip\` and commit to public/downloads/.`,
        detail: (err as Error).message,
      },
      { status: 404 },
    );
  }

  // Best-effort audit log: only if there's a Clerk session. A signed-out
  // download is fine and shouldn't fail. `.catch` keeps a Convex blip
  // from blocking the actual download response.
  try {
    const { userId } = await auth();
    if (userId) {
      await writeAuditLog({
        actorUserId: userId,
        targetUserId: userId,
        action: "EXTENSION_DOWNLOAD_INITIATED",
        entityType: "User",
        entityId: userId,
        metadataJson: { version: manifest.version, file: ZIP_BASENAME },
      }).catch(() => null);
    }
  } catch {
    // No session — skip the log entirely.
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${ZIP_BASENAME}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
