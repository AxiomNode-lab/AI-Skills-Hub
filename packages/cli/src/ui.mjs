// Terminal styling. Color is used only for interactive terminals and follows the
// NO_COLOR (https://no-color.org) and FORCE_COLOR conventions; JSON output never
// passes through these helpers. Windows 10+ terminals render these ANSI codes.
export function colorEnabled(stream = process.stdout, env = process.env) {
  if ("NO_COLOR" in env && env.NO_COLOR !== "") return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== "0") return true;
  return Boolean(stream?.isTTY) && env.TERM !== "dumb";
}

const CODES = { bold: [1, 22], dim: [2, 22], red: [31, 39], green: [32, 39], yellow: [33, 39], cyan: [36, 39], gray: [90, 39] };

export function paint(style, text, stream = process.stdout) {
  if (!colorEnabled(stream)) return String(text);
  const [open, close] = CODES[style];
  return `\x1b[${open}m${text}\x1b[${close}m`;
}

const AVAILABILITY = {
  eligible: ["green", "installable"],
  "source-direct": ["yellow", "external installer (needs --yes)"],
  "review-required": ["yellow", "awaiting review"],
  "catalog-only": ["gray", "catalog only"],
  blocked: ["red", "blocked"]
};

const INSTALLATION_STYLE = { installed: "green", unverified: "yellow", "not-recorded": "gray" };

// The status keyword, colored (scripts and docs match on the keyword).
export function availabilityLabel(status, stream) {
  return paint((AVAILABILITY[status] ?? ["gray"])[0], status, stream);
}

export function installationLabel(status, stream) {
  return paint(INSTALLATION_STYLE[status] ?? "gray", status, stream);
}

// Sorts by id and splits into [publisher, skills] groups for listings.
export function groupByPublisher(skills) {
  const groups = new Map();
  for (const skill of [...skills].sort((a, b) => a.id.localeCompare(b.id))) {
    const owner = skill.id.split("/")[0];
    if (!groups.has(owner)) groups.set(owner, []);
    groups.get(owner).push(skill);
  }
  return [...groups];
}

// Plain-language description of a status, for interactive lists.
export function availabilityText(status, stream) {
  const [style, text] = AVAILABILITY[status] ?? ["gray", status];
  return paint(style, text, stream);
}

// "none" means the pattern scanner matched nothing; it is not a guarantee.
export function riskLabel(risk, stream) {
  const style = { none: "green", low: "green", medium: "yellow", high: "red" }[risk] ?? "gray";
  return paint(style, risk === "none" ? "no scanner findings" : `${risk ?? "unknown"} risk`, stream);
}

// The scanner's verdict with what it matched, for `info`.
export function securitySummary(security = {}, { reviewed = false, stream } = {}) {
  const findings = security.findings ?? [];
  if (!findings.length) return `${riskLabel(security.risk ?? "unknown", stream)}${security.scan_status ? paint("dim", ` (${security.scan_status})`, stream) : ""}`;
  const types = [...new Set(findings.map((finding) => finding.type))].join(", ");
  return `${riskLabel(security.risk, stream)} — ${findings.length} pattern match${findings.length === 1 ? "" : "es"} (${types})${reviewed ? "; each was reviewed before release" : ""}`;
}

// Shortens text to fit one terminal line.
export function truncate(text, width) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > width ? value.slice(0, Math.max(0, width - 1)) + "…" : value;
}

// Release reasons recorded in the catalog, in words a user can act on.
const REASON_TEXT = {
  "manual-review-required": "awaiting review",
  "non-redistributable": "its license does not allow the Hub to ship it",
  "upstream-service-retired": "the service it targets was retired",
  "upstream-service-retiring": "the service it targets is being retired",
  "upstream-skill-missing": "the skill no longer exists upstream",
  "upstream-moved": "it moved to another upstream location",
  "upstream-api-removed": "it uses an API that was removed upstream",
  "required-skill-not-released": "it needs a skill that is not released",
  "unsafe-four-byte-dek-example": "held for an unsafe code example"
};

export function reasonText(code) {
  return REASON_TEXT[code] ?? String(code).replace(/[-_]+/g, " ");
}

// One short phrase for why a catalog entry cannot be installed with `install`.
export function whyNotInstallable(cap, status) {
  const reasons = (cap.release?.reasons ?? []).filter((code) => code !== "manual-review-required").map(reasonText);
  switch (status) {
    case "blocked": return `blocked${reasons.length ? ": " + reasons.join("; ") : ""}`;
    case "review-required": return "awaiting review";
    case "source-direct": return `external installer only (needs --yes)${reasons.length ? ": " + reasons.join("; ") : ""}`;
    default: return reasons.length ? `held: ${reasons.join("; ")}` : "not released";
  }
}
