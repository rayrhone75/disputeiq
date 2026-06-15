import { ConnectorTestClient } from "../_components/ConnectorTestClient";

export const dynamic = "force-dynamic";

export default function MyScoreIqTestPage() {
  return <ConnectorTestClient providerId="MYSCOREIQ" providerLabel="MyScoreIQ" />;
}
