export const EXPORT_APP_NAME = "Ledger Core";
export const EXPORT_TAGLINE = "Offline personal expense tracker";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none"><defs><linearGradient id="bg" x1="64" y1="48" x2="448" y2="464" gradientUnits="userSpaceOnUse"><stop stop-color="#111114"/><stop offset="1" stop-color="#0a0a0b"/></linearGradient><linearGradient id="accent" x1="156" y1="140" x2="356" y2="372" gradientUnits="userSpaceOnUse"><stop stop-color="#5eead4"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#bg)"/><rect x="128" y="148" width="256" height="216" rx="28" fill="#18181b" stroke="#3f3f46" stroke-width="3"/><rect x="148" y="168" width="12" height="176" rx="6" fill="#27272a"/><rect x="188" y="284" width="36" height="56" rx="8" fill="url(#accent)" opacity="0.45"/><rect x="238" y="248" width="36" height="92" rx="8" fill="url(#accent)" opacity="0.7"/><rect x="288" y="212" width="36" height="128" rx="8" fill="url(#accent)"/><text x="256" y="210" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" font-weight="700" fill="url(#accent)">&#x20B9;</text><path d="M176 320 L228 292 L278 304 L336 248" stroke="#2dd4bf" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/><circle cx="336" cy="248" r="10" fill="#2dd4bf"/></svg>`;

const LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

export function getLogoDataUri() {
  return LOGO_DATA_URI;
}

export function escapePrintHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildBrandedPrintDocument(title, bodyHtml, options = {}) {
  const logo = getLogoDataUri();
  const safeTitle = escapePrintHtml(title || EXPORT_APP_NAME);
  const subtitleHtml = options.subtitle
    ? `<br><span>${escapePrintHtml(options.subtitle)}</span>`
    : "";
  const generated = escapePrintHtml(options.generatedAt || new Date().toLocaleString("en-IN"));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <style>
    @page { margin: 16mm 14mm 20mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #18181b;
      background: #fff;
    }
    .export-page {
      position: relative;
      min-height: 100vh;
      padding: 8px 0 48px;
    }
    .export-page::before {
      content: "";
      position: fixed;
      top: 50%;
      left: 50%;
      width: 320px;
      height: 320px;
      transform: translate(-50%, -50%) rotate(-28deg);
      background: url("${logo}") center / contain no-repeat;
      opacity: 0.055;
      pointer-events: none;
      z-index: 0;
    }
    .export-content { position: relative; z-index: 1; }
    .export-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 14px;
      margin-bottom: 22px;
      border-bottom: 2px solid #2dd4bf;
    }
    .export-logo {
      width: 52px;
      height: 52px;
      flex-shrink: 0;
      border-radius: 12px;
    }
    .export-brand h1 {
      margin: 0;
      font-size: 1.35rem;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .export-brand p {
      margin: 4px 0 0;
      font-size: 0.82rem;
      color: #64748b;
    }
    .export-meta {
      margin: 0 0 18px;
      font-size: 0.85rem;
      color: #64748b;
    }
    .export-body h1 { font-size: 1.15rem; margin: 0 0 12px; }
    .export-body p { line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 12px; }
    th, td { border: 1px solid #d4d4d8; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #f4f4f5; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    .export-footer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 8mm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 0.72rem;
      color: #94a3b8;
      z-index: 2;
      pointer-events: none;
    }
    .export-footer img {
      width: 18px;
      height: 18px;
      opacity: 0.75;
    }
    @media print {
      .export-page::before { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .export-header { break-after: avoid; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="export-page">
    <div class="export-content">
      <header class="export-header">
        <img src="${logo}" alt="" class="export-logo" width="52" height="52">
        <div class="export-brand">
          <h1>${EXPORT_APP_NAME}</h1>
          <p>${EXPORT_TAGLINE}</p>
        </div>
      </header>
      <p class="export-meta"><strong>${safeTitle}</strong>${subtitleHtml}<br>Generated ${generated}</p>
      <div class="export-body">${bodyHtml}</div>
    </div>
    <footer class="export-footer">
      <img src="${logo}" alt="">
      <span>${EXPORT_APP_NAME} · ${EXPORT_TAGLINE}</span>
    </footer>
  </div>
</body>
</html>`;
}

export function wrapCsvExport(csv, meta = {}) {
  const lines = [
    `# ${EXPORT_APP_NAME} — ${EXPORT_TAGLINE}`,
    `# Generated: ${new Date().toISOString()}`,
  ];
  if (meta.period) lines.push(`# Period: ${meta.period}`);
  if (meta.scope) lines.push(`# Scope: ${meta.scope}`);
  lines.push("#");
  return `${lines.join("\n")}\n${csv}`;
}

export function stampJsonExport(data, meta = {}) {
  return {
    ...data,
    generator: {
      app: EXPORT_APP_NAME,
      tagline: EXPORT_TAGLINE,
      exportType: meta.exportType || "backup",
      period: meta.period || null,
      exportedAt: data.exportedAt || new Date().toISOString(),
    },
  };
}
