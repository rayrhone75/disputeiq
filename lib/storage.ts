// Secure object storage. Cloudflare R2 (S3-compatible) when credentials are
// present; falls back to in-memory for local dev so the app still boots.
//
// Files are PRIVATE. We never return public URLs for sensitive documents.
// `signedUrl` issues a short-lived presigned GET so a server route can stream
// or hand out a temporary link — never use it for raw letters pre-payment.
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface SecureStorage {
  put(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  signedUrl(key: string, ttlSeconds?: number): Promise<string>;
}

class MemoryStorage implements SecureStorage {
  private store = new Map<string, Buffer>();
  async put(key: string, body: Buffer | Uint8Array) {
    this.store.set(key, Buffer.from(body));
    return `secure://${key}`;
  }
  async get(key: string) {
    const v = this.store.get(key.replace(/^secure:\/\//, ""));
    if (!v) throw new Error("NOT_FOUND");
    return v;
  }
  async signedUrl(key: string) {
    return `secure://${key}`;
  }
}

class R2Storage implements SecureStorage {
  private client: S3Client;
  private bucket: string;
  constructor(opts: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
      forcePathStyle: true,
    });
    this.bucket = opts.bucket;
  }
  async put(key: string, body: Buffer | Uint8Array, contentType?: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return `r2://${this.bucket}/${key}`;
  }
  async get(key: string) {
    const k = key.replace(new RegExp(`^r2://${this.bucket}/`), "");
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: k }));
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as any) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  async signedUrl(key: string, ttlSeconds = 300) {
    const k = key.replace(new RegExp(`^r2://${this.bucket}/`), "");
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: k }), {
      expiresIn: ttlSeconds,
    });
  }
}

function build(): SecureStorage {
  const { STORAGE_BUCKET, STORAGE_REGION, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_ENDPOINT } = process.env;
  if (STORAGE_BUCKET && STORAGE_ACCESS_KEY && STORAGE_SECRET_KEY && STORAGE_ENDPOINT) {
    return new R2Storage({
      endpoint: STORAGE_ENDPOINT,
      region: STORAGE_REGION ?? "auto",
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET_KEY,
      bucket: STORAGE_BUCKET,
    });
  }
  return new MemoryStorage();
}

export const storage: SecureStorage = build();
