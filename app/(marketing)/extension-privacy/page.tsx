// Public privacy policy specifically for the DisputeIQ Connector
// Chrome extension. Linked from the Web Store listing — Google
// requires a stable HTTPS privacy URL for any extension that handles
// user data.

export const metadata = {
  title: "DisputeIQ Connector — Privacy Policy",
  description:
    "Privacy practices for the DisputeIQ Connector Chrome extension.",
};

const LAST_UPDATED = "April 30, 2026";

export default function ExtensionPrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-fg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">
        Chrome extension
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        DisputeIQ Connector — Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-fg/60">Last updated {LAST_UPDATED}</p>

      <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">
        <h2>What the extension does</h2>
        <p>
          The DisputeIQ Connector lets a customer of{" "}
          <a href="https://disputeiq.org">DisputeIQ.org</a> import a copy
          of their MyScoreIQ tri-merge credit-report JSON into their
          DisputeIQ workspace with a single click, instead of copy-pasting
          the file manually. It runs only on{" "}
          <code>member.myscoreiq.com</code> (the customer&apos;s own
          authenticated MyScoreIQ tab) and on{" "}
          <code>disputeiq.org</code>.
        </p>

        <h2>Data the extension reads</h2>
        <ul>
          <li>
            <strong>The credit-report JSON</strong> that your authenticated
            MyScoreIQ session has already loaded in your browser. The
            extension reads <code>document.body.innerText</code> on the
            JSON view of your report — the same content you see on
            screen.
          </li>
          <li>
            <strong>The DisputeIQ pairing token</strong> that you generate
            from your DisputeIQ dashboard and paste into the extension
            popup. The extension stores a long-lived bearer token derived
            from that pairing in <code>chrome.storage.local</code> on
            your device only.
          </li>
        </ul>

        <h2>Data the extension does NOT read</h2>
        <ul>
          <li>
            <strong>Your MyScoreIQ password.</strong> The extension never
            sees, stores, or transmits any credentials — login is handled
            entirely by MyScoreIQ in your browser.
          </li>
          <li>
            <strong>Pages other than MyScoreIQ and DisputeIQ.</strong> The
            extension declares <code>host_permissions</code> for those
            two origins only; Chrome enforces this at install time. It
            does not read browsing history, other tabs, or any third-party
            site.
          </li>
          <li>
            <strong>Your clipboard, microphone, camera, or location.</strong>{" "}
            The extension requests none of these permissions.
          </li>
        </ul>

        <h2>Data we send to DisputeIQ</h2>
        <p>
          When you click <strong>Import</strong> in the extension popup,
          the extension sends:
        </p>
        <ul>
          <li>
            The raw JSON body of your MyScoreIQ report (encrypted at rest
            by DisputeIQ).
          </li>
          <li>
            Your pairing-derived bearer token, used by DisputeIQ to
            identify which DisputeIQ account the import belongs to.
          </li>
          <li>
            A short audit-log entry recording <code>EXTENSION_IMPORT_ATTEMPT</code>{" "}
            and <code>EXTENSION_IMPORT_SUCCESS</code> or{" "}
            <code>EXTENSION_IMPORT_FAILED</code>. No payload data is
            stored in the audit log — only counts and outcome codes.
          </li>
        </ul>

        <h2>Storage</h2>
        <p>
          On your device, in <code>chrome.storage.local</code>: the bearer
          token, its expiration, your DisputeIQ email, and the timestamp +
          outcome of the most recent import. Nothing else.
        </p>
        <p>
          On DisputeIQ&apos;s servers: the imported credit report (encrypted
          at rest, AES-256-GCM), normalized tradelines / inquiries /
          collections, and dispute candidates derived from them — same
          storage you see in your DisputeIQ workspace.
        </p>

        <h2>Sharing</h2>
        <p>
          We do not sell or share your data with any third party. The
          extension communicates only with{" "}
          <code>https://disputeiq.org</code>.
        </p>

        <h2>Revocation and deletion</h2>
        <p>
          You can revoke the extension at any time from your DisputeIQ
          dashboard&apos;s Connector card — the bearer token is invalidated
          immediately. You can also uninstall the extension from{" "}
          <code>chrome://extensions</code>; uninstalling clears all locally
          stored extension data. To delete your DisputeIQ account and all
          associated imports, contact{" "}
          <a href="mailto:support@disputeiq.org">support@disputeiq.org</a>.
        </p>

        <h2>Permissions explained</h2>
        <ul>
          <li>
            <code>storage</code> — used only to persist the bearer token
            and the most-recent import outcome in{" "}
            <code>chrome.storage.local</code>.
          </li>
          <li>
            <code>activeTab</code> — used by the popup to read the JSON
            of the currently active MyScoreIQ tab when you click Import.
          </li>
          <li>
            <code>host_permissions</code>:{" "}
            <code>member.myscoreiq.com</code> and the DisputeIQ origins.
            No other site is accessed.
          </li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions about this policy:{" "}
          <a href="mailto:support@disputeiq.org">support@disputeiq.org</a>.
          The full DisputeIQ platform privacy policy is available at{" "}
          <a href="/privacy">/privacy</a>.
        </p>
      </div>
    </article>
  );
}
