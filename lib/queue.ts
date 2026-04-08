// Minimal in-process queue interface. Swap for BullMQ/QStash/Vercel Queues.
type Job<T> = { name: string; payload: T };
type Handler<T = any> = (payload: T) => Promise<void>;

const handlers = new Map<string, Handler>();

export function registerHandler<T>(name: string, fn: Handler<T>) {
  handlers.set(name, fn as Handler);
}

export async function enqueue<T>(job: Job<T>) {
  const h = handlers.get(job.name);
  if (!h) throw new Error(`No handler for job: ${job.name}`);
  // Fire-and-forget for the stub. Replace with durable queue in prod.
  queueMicrotask(() => h(job.payload).catch((e) => console.error(job.name, e)));
}
