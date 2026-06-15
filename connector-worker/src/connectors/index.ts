import type { BaseConnector } from "./base.js";
import { MyScoreIQConnector } from "./myscoreiq.js";
import { MyFreeScoreNowConnector } from "./myfreescorenow.js";
import type { ProviderId } from "../types.js";

const REGISTRY: Record<ProviderId, BaseConnector> = {
  MYSCOREIQ: new MyScoreIQConnector(),
  MYFREESCORENOW: new MyFreeScoreNowConnector(),
};

export function getConnector(id: string): BaseConnector | null {
  return (REGISTRY as Record<string, BaseConnector>)[id] ?? null;
}

export function allConnectors(): BaseConnector[] {
  return Object.values(REGISTRY);
}
