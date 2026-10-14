const CATALOG_URL = "./catalog.json";
const STANDARD_AGENTS = new Set(["claude-code", "codex", "cursor", "github-copilot", "opencode", "generic-agent", "agent-skills"]);
const PAGE_SIZE = 30;

const queryInput = document.querySelector("#query");
const agentFilter = document.querySelector("#agent-filter");
const statusFilter = document.querySelector("#status-filter");
const categoryFilter = document.querySelector("#category-filter");
const sortSelect = document.querySelector("#sort");
const resultsRoot = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const filterSummary = document.querySelector("#filter-summary");
const emptyState = document.querySelector("#empty-state");
const loadMoreButton = document.querySelector("#load-more");
const resetButton = document.querySelector("#reset");
const searchForm = document.querySelector("#search-form");

let catalog = [];
let visibleLimit = PAGE_SIZE;
let lastFiltered = [];
let loadError = null;

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function statusName(status) {
  return ({
    eligible: "Ready to install",
    "review-required": "Review required",
    "source-direct": "External source",
    blocked: "Blocked",
    "catalog-only": "Catalog only"
  })[status] || "Status unknown";
}
function isCompatible(skill, target) {
  if (target === "any") return true;
  const compatibility = Array.isArray(skill.compatibility) ? skill.compatibility : [];
  if (compatibility.includes(target)) return true;
  return compatibility.includes("agent-skills") && STANDARD_AGENTS.has(target);
}
function getTextIndex(skill) {
  return [skill.id, skill.name, skill.publisher, skill.description, ...(skill.category || []), ...(skill.tags || []), skill.source?.repo, skill.license?.spdx].join(" ").toLocaleLowerCase();
}
function fillCategories() {
  const categories = new Set();
  for (const skill of catalog) {
    if (skill.releaseStatus === "eligible") for (const item of skill.category || []) {
      if (item && item !== "general") categories.add(item);
    }
  }
  for (const item of [...categories].sort((a, b) => a.localeCompare(b))) {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item.replaceAll("-", " ");
    categoryFilter.append(option);
  }
}
function cardHTML(skill) {
  const status = skill.releaseStatus || "catalog-only";
  const pageLink = skill.pageUrl || skill.source?.url || "https://github.com/AxiomNode-lab/AI-Skills-Hub";
  const openLabel = skill.pageUrl ? "View details ↗" : "Inspect source ↗";
  const categories = [...(skill.category || []), ...(skill.tags || [])].filter(Boolean).slice(0, 3);
  const description = skill.description || "No description has been published for this catalog entry.";
  return '<article class="skill-card">' +
    '<div class="card-top"><span class="publisher" title="' + esc(skill.publisher) + '">' + esc(skill.publisher || "Unknown publisher") + '</span>' +
    '<span class="status-pill ' + esc(status) + '">' + esc(statusName(status)) + '</span></div>' +
    '<h3><a href="' + esc(pageLink) + '">' + esc(skill.name || skill.id) + '</a></h3>' +
    '<p class="skill-description">' + esc(description) + '</p>' +
    '<div class="card-meta">' + categories.map(tag => '<span class="tag">' + esc(tag) + '</span>').join("") + '</div>' +
    '<div class="card-bottom"><span class="license-pill">' + esc(skill.license?.spdx || "License unknown") + '</span>' +
    '<a class="card-link" href="' + esc(pageLink) + '">' + openLabel + '</a></div></article>';
}
function filterSkills() {
  const query = queryInput.value.trim().toLocaleLowerCase();
  const agent = agentFilter.value;
  const status = statusFilter.value;
  const category = categoryFilter.value;
  const matches = catalog.filter(skill => {
    if (status !== "all" && (skill.releaseStatus || "catalog-only") !== status) return false;
    if (category !== "all" && !(skill.category || []).includes(category)) return false;
    if (!isCompatible(skill, agent)) return false;
    if (query && !getTextIndex(skill).includes(query)) return false;
    return true;
  });
  if (sortSelect.value === "name") matches.sort((a,b) => String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)));
  else if (sortSelect.value === "publisher") matches.sort((a,b) => String(a.publisher).localeCompare(String(b.publisher)) || String(a.name).localeCompare(String(b.name)));
  else matches.sort((a,b) => Number(b.releaseStatus === "eligible") - Number(a.releaseStatus === "eligible") || String(a.id).localeCompare(String(b.id)));
  return matches;
}
function render() {
  if (loadError) {
    resultsRoot.innerHTML = "";
    resultsRoot.setAttribute("aria-busy", "false");
    resultsRoot.innerHTML = '<div class="loading-card">' + esc(loadError) + ' <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub">Open the repository</a>.</div>';
    resultCount.textContent = "Unavailable";
    filterSummary.textContent = "The catalog could not be loaded.";
    loadMoreButton.hidden = true;
    emptyState.hidden = true;
    return;
  }
  lastFiltered = filterSkills();
  const shown = lastFiltered.slice(0, visibleLimit);
  resultsRoot.innerHTML = shown.map(cardHTML).join("");
  resultsRoot.setAttribute("aria-busy", "false");
  resultCount.textContent = new Intl.NumberFormat().format(lastFiltered.length);
  filterSummary.textContent = "Showing " + Math.min(shown.length, lastFiltered.length) + " of " + lastFiltered.length.toLocaleString() + " entries · " + catalog.filter(x => x.releaseStatus === "eligible").length.toLocaleString() + " currently marked ready to install";
  emptyState.hidden = lastFiltered.length !== 0;
  loadMoreButton.hidden = shown.length >= lastFiltered.length;
}
function applyFilters() {
  visibleLimit = PAGE_SIZE;
  render();
}
queryInput.addEventListener("input", applyFilters);
agentFilter.addEventListener("change", applyFilters);
statusFilter.addEventListener("change", applyFilters);
categoryFilter.addEventListener("change", applyFilters);
sortSelect.addEventListener("change", applyFilters);
searchForm.addEventListener("submit", event => { event.preventDefault(); applyFilters(); });
loadMoreButton.addEventListener("click", () => { visibleLimit += PAGE_SIZE; render(); });
resetButton.addEventListener("click", () => {
  queryInput.value = "";
  agentFilter.value = "any";
  statusFilter.value = "eligible";
  categoryFilter.value = "all";
  sortSelect.value = "relevance";
  applyFilters();
  queryInput.focus();
});
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName) && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    queryInput.focus();
  }
});

fetch(CATALOG_URL)
  .then(response => {
    if (!response.ok) throw new Error("Catalog request failed (" + response.status + ")");
    return response.json();
  })
  .then(data => {
    catalog = Array.isArray(data.skills) ? data.skills : [];
    fillCategories();
    render();
  })
  .catch(() => {
    loadError = "The searchable catalog is temporarily unavailable.";
    render();
  });
