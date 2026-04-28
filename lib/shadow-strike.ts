import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export type ShadowStrikeProvider = "LEXISNEXIS" | "INNOVIS" | "SAGESTREAM";

export async function queueShadowStrike(input: {
  provider: ShadowStrikeProvider;
  userConfirmed: boolean;
}) {
  if (!input.userConfirmed) throw new Error("User confirmation required.");
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) throw new Error("UNAUTHENTICATED");
  return await fetchMutation(
    api.onboarding.queueShadowStrike,
    { provider: input.provider },
    { token },
  );
}
