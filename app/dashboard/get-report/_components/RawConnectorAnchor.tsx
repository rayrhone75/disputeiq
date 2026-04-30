"use client";

// React 19 sanitizes `javascript:` URLs out of `href` attributes — it
// silently rewrites them to no-ops, breaking bookmarklets. This is a
// known security feature, not a bug.
//
// To render a real `<a href="javascript:...">` for drag-to-bookmarks
// installation, we have to bypass React's URL handling. The smallest
// safe escape hatch is `dangerouslySetInnerHTML` on a wrapper element,
// which inserts raw HTML that React doesn't try to interpret.
//
// We HTML-escape the bookmarklet code defensively before injecting so
// no attribute-quote-breakout is possible. The `code` arg is generated
// server-side from a signed token (lib/auth/bookmarklet-token.ts) and
// passed through encodeURI in `buildConnectorHref` — but we do NOT
// trust that as our XSS gate; the HTML escape below is the gate.

type Props = {
  /**
   * Already-built `javascript:...` URL. Treat as untrusted and
   * HTML-escape before injecting.
   */
  href: string;
  className?: string;
  title?: string;
  /**
   * Inner contents of the anchor. Plain text — escaped before injection.
   */
  label: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function RawConnectorAnchor({
  href,
  className = "",
  title = "Drag this to your bookmarks bar",
  label,
}: Props) {
  // Defensive: only allow javascript: URLs through this component, since
  // that's its sole purpose. Anything else falls back to a regular anchor
  // that React would render fine.
  if (!href.startsWith("javascript:")) {
    return (
      <a href={href} className={className} title={title}>
        {label}
      </a>
    );
  }

  const safeHref = escapeHtml(href);
  const safeClass = escapeHtml(className);
  const safeTitle = escapeHtml(title);
  const safeLabel = escapeHtml(label);

  // onclick="event.preventDefault();return false;" stops accidental
  // single-clicks on the dashboard from firing the bookmarklet (which
  // would just alert "not a JSON page" because we're not on MyScoreIQ).
  // Same UX the React onClick had before.
  const html = `<a href="${safeHref}" draggable="true" class="${safeClass}" title="${safeTitle}" onclick="event.preventDefault();return false;">${safeLabel}</a>`;

  return (
    <span
      className="inline-block"
      // eslint-disable-next-line react/no-danger -- intentional: bypass React 19's javascript: URL sanitization
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
