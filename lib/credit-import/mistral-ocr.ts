// PDF → markdown via Mistral OCR API.
//
// Three calls: upload file → fetch signed URL → run OCR. Mirrors VH's
// production extractor (violationHunterai/backend/api_server.py:253-312).
// We use this in place of pdf-parse because pdf-parse returns empty
// text on image/scanned PDFs (the majority of MyScoreIQ "Print → Save
// as PDF" exports) and on encrypted PDFs.
//
// `cleanOcrMarkdown` then strips OCR-pass boilerplate (nav footers,
// page headers, legend rows, payment-history filler) — ~30–50% token
// reduction before the paralegal LLM runs.

const MISTRAL_API_BASE = "https://api.mistral.ai/v1";

export class MistralOcrError extends Error {
  status: number;
  body: string;
  stage: "upload" | "sign" | "ocr";
  constructor(stage: "upload" | "sign" | "ocr", status: number, body: string) {
    super(`Mistral OCR ${stage} failed (${status}): ${body.slice(0, 500)}`);
    this.name = "MistralOcrError";
    this.stage = stage;
    this.status = status;
    this.body = body;
  }
}

export type MistralOcrResult = {
  markdown: string;
  pageCount: number;
};

export async function extractPdfWithMistralOcr(
  buf: Buffer,
  filename: string,
): Promise<MistralOcrResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new MistralOcrError("upload", 0, "MISTRAL_API_KEY environment variable is not set.");
  }

  // 1. Upload file.
  const uploadForm = new FormData();
  uploadForm.append(
    "file",
    new Blob([new Uint8Array(buf)], { type: "application/pdf" }),
    filename || "report.pdf",
  );
  uploadForm.append("purpose", "ocr");

  const uploadRes = await fetch(`${MISTRAL_API_BASE}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: uploadForm,
  });
  if (!uploadRes.ok) {
    throw new MistralOcrError("upload", uploadRes.status, await uploadRes.text());
  }
  const uploadJson = (await uploadRes.json()) as { id?: string };
  const fileId = uploadJson.id;
  if (!fileId) {
    throw new MistralOcrError("upload", uploadRes.status, "upload response missing id");
  }

  // 2. Get signed URL.
  const signedRes = await fetch(`${MISTRAL_API_BASE}/files/${fileId}/url`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!signedRes.ok) {
    await deleteFileBestEffort(fileId, apiKey);
    throw new MistralOcrError("sign", signedRes.status, await signedRes.text());
  }
  const signedJson = (await signedRes.json()) as { url?: string };
  const signedUrl = signedJson.url;
  if (!signedUrl) {
    await deleteFileBestEffort(fileId, apiKey);
    throw new MistralOcrError("sign", signedRes.status, "signed response missing url");
  }

  // 3. Run OCR.
  const ocrRes = await fetch(`${MISTRAL_API_BASE}/ocr`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document: { type: "document_url", document_url: signedUrl },
    }),
  });
  if (!ocrRes.ok) {
    await deleteFileBestEffort(fileId, apiKey);
    throw new MistralOcrError("ocr", ocrRes.status, await ocrRes.text());
  }
  const ocrJson = (await ocrRes.json()) as {
    pages?: Array<{ index?: number; markdown?: string }>;
  };

  await deleteFileBestEffort(fileId, apiKey);

  const pages = ocrJson.pages ?? [];
  const parts = pages.map((page, i) => {
    const idx = typeof page.index === "number" ? page.index : i;
    return `--- Page ${idx + 1} ---\n${page.markdown ?? ""}`;
  });
  return {
    markdown: parts.join("\n\n"),
    pageCount: pages.length,
  };
}

async function deleteFileBestEffort(fileId: string, apiKey: string): Promise<void> {
  try {
    await fetch(`${MISTRAL_API_BASE}/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    // Non-fatal: Mistral garbage-collects orphans.
  }
}

// Boilerplate stripper. Port of VH's `clean_ocr_markdown` +
// `clean_ocr_for_analysis` (api_server.py:145-250) combined into one
// pass. Run on Mistral OCR output before sending to the paralegal LLM.
export function cleanOcrMarkdown(text: string): string {
  let out = text;

  // Light pass first — structural noise from page boundaries.
  // 1. Page separators.
  out = out.replace(/^--- Page \d+ ---\s*$/gm, "");
  // 2. Navigation footer (Summary | Revolving | ... | Collections) +
  //    optional table separator row.
  out = out.replace(
    /^\|?\s*Summary\s*\|.*?Collections\s*\|?\s*\n(?:\|[\s\-|]+\|\s*\n)?/gm,
    "",
  );
  // 3. Page header banner ("Mar 08, 2026 Three Bureau Credit Report ...").
  out = out.replace(
    /^[A-Z][a-z]{2} \d{2}, \d{4} Three Bureau Credit Report powered by Equifax\s*$/gm,
    "",
  );
  // 4. "Page N of M" footers.
  out = out.replace(/^Page \d+ of \d+\s*$/gm, "");
  // 5. Duplicate bureau table headers that appear after page breaks.
  out = out.replace(
    /\n{2,}\|\s+\|\s*Equifax\s*\|\s*Experian\s*\|\s*TransUnion\s*\|\s*\n\|[\s\-|]+\|\s*\n/g,
    "\n",
  );

  // Aggressive pass — verbose boilerplate that the LLM doesn't need.
  // Each regex below cuts a fixed boilerplate string. They use the `[\s\S]`
  // class to match across line boundaries (JS regex lacks Python's
  // re.DOTALL flag without `s`).
  const boilerplate: Array<[RegExp, string]> = [
    [/Your debt-to-credit ratio represents[\s\S]*?30% or less\.\s*/g, ""],
    [/This tables below show up to 7 years[\s\S]*?collections\.\s*/g, ""],
    [/The tables below shows a summary[\s\S]*?each bureau\.\s*/g, ""],
    [/View the detailed information about this account[\s\S]*?question\.\s*/g, ""],
    [/^\|?\s*\?\s*Paid on Time.*?$/gm, ""],
    [/^\|?\s*C\s+Collection Account\s*\|.*?$/gm, ""],
    [/^\|?\s*\?\s*No Data Available.*?$/gm, ""],
    [/Inquiries are requests from creditors[\s\S]*?credit score\.\s*/g, ""],
    [/Hard inquiries -- those made by[\s\S]*?one year\.\s*/g, ""],
    [/Soft inquiries, such as reviewing[\s\S]*?one year\.\s*/g, ""],
    [/Collections are accounts with outstanding[\s\S]*?credit score\.\s*/g, ""],
    [/A public record is a legal document[\s\S]*?credit score\s*/g, ""],
    [/Bankruptcies are a legal status[\s\S]*?credit score\.\s*/g, ""],
    [/Consumer statements are personal notes[\s\S]*?credit score\.\s*/g, ""],
    [/Review this summary for a quick view[\s\S]*?credit scores and ratings\.\s*/g, ""],
    [/Your credit score and rating are not part[\s\S]*?your file\.\s*/g, ""],
    [/You currently have no \w[\w\s]* on your credit file\.\s*/g, ""],
  ];
  for (const [pattern, replacement] of boilerplate) {
    out = out.replace(pattern, replacement);
  }

  // Final whitespace collapse.
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
