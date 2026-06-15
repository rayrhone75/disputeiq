import { ConnectorTestClient } from "../_components/ConnectorTestClient";

export const dynamic = "force-dynamic";

export default function MyFreeScoreNowTestPage() {
  return (
    <ConnectorTestClient providerId="MYFREESCORENOW" providerLabel="MyFreeScoreNow" />
  );
}
