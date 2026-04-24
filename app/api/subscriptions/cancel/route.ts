import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { cancelSquareSubscription } from "@/lib/square-subscriptions";

export async function POST() {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const result = await fetchMutation(
      api.subscriptions.cancelForUser,
      {},
      { token },
    );
    if (result.squareSubscriptionId) {
      await cancelSquareSubscription(result.squareSubscriptionId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("NO_SUBSCRIPTION")) {
      return NextResponse.json({ error: "NO_SUBSCRIPTION" }, { status: 404 });
    }
    return NextResponse.json({ error: "INTERNAL", message: msg }, { status: 500 });
  }
}
