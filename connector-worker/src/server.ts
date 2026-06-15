// DisputeIQ connector worker — HTTP API.
//
// Runs on a VPS/container with Playwright + Chromium installed. The
// Vercel app calls these endpoints (never runs Playwright itself).
// Auth: every request must carry `Authorization: Bearer <WORKER_SECRET>`.
//
//   POST /v1/import        { provider, credentials, mfaCode? }  → ImportResult
//   POST /v1/test          { provider, credentials, mfaCode? }  → TestResult (screenshots)
//   GET  /v1/health        → { providers: [{ provider, status, checks }] }
//   GET  /v1/health/:id    → { provider, status, checks }
//   GET  /healthz          → liveness (no auth)

import express from "express";
import { z } from "zod";
import { getConnector, allConnectors } from "./connectors/index.js";

const PORT = Number(process.env.PORT ?? 8787);
const WORKER_SECRET = process.env.CONNECTOR_WORKER_SECRET ?? "";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ── liveness (unauthenticated) ───────────────────────────────────────
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ── auth middleware for /v1/* ────────────────────────────────────────
app.use("/v1", (req, res, next) => {
  if (!WORKER_SECRET) {
    res.status(500).json({ error: "WORKER_NOT_CONFIGURED" });
    return;
  }
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== WORKER_SECRET) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  next();
});

const credsSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(400),
  last4SSN: z.string().regex(/^\d{4}$/).optional(),
});

const runSchema = z.object({
  provider: z.string().min(1),
  credentials: credsSchema,
  mfaCode: z.string().max(12).optional(),
});

app.post("/v1/import", async (req, res) => {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_INPUT", issues: parsed.error.flatten() });
    return;
  }
  const connector = getConnector(parsed.data.provider);
  if (!connector) {
    res.status(400).json({ error: "UNKNOWN_PROVIDER" });
    return;
  }
  try {
    const result = await connector.run(parsed.data.credentials, parsed.data.mfaCode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "WORKER_ERROR", message: (err as Error).message });
  }
});

app.post("/v1/test", async (req, res) => {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_INPUT", issues: parsed.error.flatten() });
    return;
  }
  const connector = getConnector(parsed.data.provider);
  if (!connector) {
    res.status(400).json({ error: "UNKNOWN_PROVIDER" });
    return;
  }
  try {
    const result = await connector.test(parsed.data.credentials, {
      mfaCode: parsed.data.mfaCode,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "WORKER_ERROR", message: (err as Error).message });
  }
});

app.get("/v1/health/:id", async (req, res) => {
  const connector = getConnector(req.params.id);
  if (!connector) {
    res.status(400).json({ error: "UNKNOWN_PROVIDER" });
    return;
  }
  const probe = await connector.probe();
  res.json({ provider: connector.id, ...probe });
});

app.get("/v1/health", async (_req, res) => {
  const providers = [];
  for (const c of allConnectors()) {
    const probe = await c.probe();
    providers.push({ provider: c.id, label: c.label, ...probe });
  }
  res.json({ providers });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[connector-worker] listening on :${PORT}`);
});
