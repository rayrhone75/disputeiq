import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MessagesClient } from "./MessagesClient";

// Customer-facing Messages page — minimal server wrapper.
// All Convex work happens client-side via /api/messages/*; the page
// itself can never 500 on a Convex blip.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages — DisputeIQ",
  description: "Conversations with the DisputeIQ support team.",
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ threadId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/dashboard/messages");
  }
  const params = (await searchParams) ?? {};
  const initialThreadId =
    typeof params.threadId === "string" && params.threadId
      ? params.threadId
      : null;
  return <MessagesClient initialThreadId={initialThreadId} />;
}
