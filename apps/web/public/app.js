const API = window.AI_SKILLS_API_URL || "";
const els = {
  search: document.querySelector("#search"),
  agent: document.querySelector("#agent"),
  distribution: document.querySelector("#distribution"),
  category: document.querySelector("#category"),
  clear: document.querySelector("#clear"),
  discover: document.querySelector("#discover"),
  searchStatus: document.querySelector("#search-status"),
  stats: document.querySelector("#stats"),
  count: document.querySelector("#count"),
  skills: document.querySelector("#skills"),
  empty: document.querySelector("#empty"),
  version: document.querySelector("#version"),
  drawer: document.querySelector("#drawer"),
  drawerTitle: document.querySelector("#drawer-title"),
  drawerBody: document.querySelector("#drawer-body"),
  drawerClose: document.querySelector("#drawer-close"),
  drawerX: document.querySelector("#drawer-x")
};

let skills = [];
let catalogSkills = [];
let discoveryMode = false;
let catalog = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);
}

async function getJson(path) {
  const response = await fetch(API + path);
  if (!response.ok) throw new Error("API " + response.status);
  return response.json();
}

async function load() {
  try {
    [catalog, catalogSkills] = await Promise.all([
      getJson("/api/catalog"),
      getJson("/api/skills?limit=100").then((result) => result.skills ?? [])
    ]);
    skills = catalogSkills;
    renderStats();
    populateFilters();
    render();
  } catch (error) {
    els.skills.innerHTML = '<div class="empty">Registry API unavailable. Start <code>node apps/api/src/server.mjs</code> and reload.</div>';
    els.empty.classList.add("hidden");
    console.error(error);
  }
}

function renderStats() {
  const distributions = catalog?.distributions ?? {};
  els.version.textContent = "schema " + escapeHtml(catalog?.schema_version ?? "unknown");
  els.stats.innerHTML = [
    ["total","Skills",catalog.total],
    ["bundled","Bundled",distributions.bundled ?? 0],
    ["source-direct","Source-direct",distributions["source-direct"] ?? 0],
    ["review-required","Review",distributions["review-required"] ?? 0]
  ].map(([key,label,value]) =>
    '<div class="stat"><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></div>'
  ).join("");
}

function populateFilters() {
  const agents = [...new Set(skills.flatMap((s) => s.compatibility ?? []))]
    .filter((x) => x !== "agent-skills")
    .sort();
  els.agent.insertAdjacentHTML("beforeend", agents.map((a) =>
    '<option value="' + escapeHtml(a) + '">' + escapeHtml(a) + '</option>'
  ).join(""));

  const categories = [...new Set(skills.flatMap((s) => s.category ?? []))].sort();
  els.category.insertAdjacentHTML("beforeend", categories.map((c) =>
    '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>'
  ).join(""));
}

async function runDiscovery() {
  const query = els.search.value.trim();
  if (!query) {
    discoveryMode = false;
    skills = catalogSkills;
    els.searchStatus.textContent = "Local registry + remote sources";
    render();
    return;
  }

  els.discover.disabled = true;
  els.searchStatus.textContent = "Searching registry + remote sources…";
  try {
    const agent = els.agent.value || "agent-skills";
    const payload = await getJson("/api/discover?q=" + encodeURIComponent(query) + "&agent=" + encodeURIComponent(agent) + "&limit=30");
    skills = (payload.results ?? []).map((entry) => ({
      ...(entry.item ?? {}),
      _score: entry.score,
      _origin: entry.origin
    }));
    discoveryMode = true;
    els.searchStatus.textContent = (payload.remote_searched ? "Hybrid discovery" : "Local discovery") + " · " + skills.length + " candidates";
    render();
  } catch (error) {
    els.searchStatus.textContent = "Remote discovery unavailable; showing local matches";
    discoveryMode = false;
    skills = catalogSkills.filter((s) => [s.id,s.name,s.publisher,...(s.category ?? [])].join(" ").toLowerCase().includes(query.toLowerCase()));
    render();
    console.error(error);
  } finally {
    els.discover.disabled = false;
  }
}

function filtered() {
  if (discoveryMode) return skills;
  const q = els.search.value.trim().toLowerCase();
  const agent = els.agent.value;
  const distribution = els.distribution.value;
  const category = els.category.value;

  return skills.filter((s) => {
    if (q && ![s.id,s.name,s.publisher,...(s.category ?? [])].join(" ").toLowerCase().includes(q)) return false;
    if (agent && !(s.compatibility ?? []).includes(agent)) return false;
    if (distribution && s.distribution !== distribution) return false;
    if (category && !(s.category ?? []).includes(category)) return false;
    return true;
  });
}

function capabilityBadges(skill) {
  const capabilities = skill.security ?? {};
  const keys = [
    ["shell","shell"],
    ["network","network"],
    ["credentials","credentials"],
    ["packageInstall","pkg install"],
    ["filesystemWrite","filesystem"]
  ];
  return keys.filter(([key]) => capabilities[key] === true)
    .map(([,label]) => '<span class="badge warning">' + escapeHtml(label) + '</span>').join("");
}

function render() {
  const items = filtered();
  els.count.textContent = items.length + " results";
  els.empty.classList.toggle("hidden", items.length !== 0);
  els.skills.innerHTML = items.map((s) => {
    const chips = (s.category ?? []).map((c) => '<span class="chip">' + escapeHtml(c) + '</span>').join("");
    const risk = s.security?.risk ?? (s.security?.scan_status === "verified" ? "low" : "pending");
    const release = s.release?.status ?? "pending";
    const revision = s.source?.revision ? s.source.revision.slice(0,8) : "unpinned";
    const origin = s._origin === "remote-github" ? "remote" : "registry";
    return '<article class="card">' +
      '<div class="card-top"><span class="state ' + escapeHtml(s.distribution) + '">' + escapeHtml(s.distribution) + '</span><span class="risk">risk:' + escapeHtml(risk) + '</span></div>' +
      '<h3>' + escapeHtml(s.name) + '</h3>' +
      '<div class="meta">' + escapeHtml(s.publisher) + ' · ' + escapeHtml(s.license?.spdx ?? "NOASSERTION") + '</div>' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="badges"><span class="badge">' + escapeHtml(release) + '</span>' + capabilityBadges(s) + '</div>' +
      '<div class="card-foot"><span class="revision">rev ' + escapeHtml(revision) + '</span><button class="details" data-id="' + encodeURIComponent(s.id) + '" type="button">Details</button></div>' +
      '</article>';
  }).join("");

  els.skills.querySelectorAll(".details").forEach((button) => {
    button.addEventListener("click", () => openDrawer(decodeURIComponent(button.dataset.id)));
  });
}

function openDrawer(id) {
  const skill = skills.find((s) => s.id === id);
  if (!skill) return;
  els.drawerTitle.textContent = skill.name;
  const sourceUrl = "https://github.com/" + skill.source.repo + "/tree/" + (skill.source.revision || "main") + "/" + skill.source.path;
  const install = skill.distribution === "source-direct" || skill.distribution === "review-required"
    ? "npx skills add " + "https://github.com/" + skill.source.repo + " --skill " + JSON.stringify(skill.name)
    : "skills-hub install " + skill.id + " --agent <agent>";
  const caps = Object.entries(skill.security ?? {})
    .filter(([key,value]) => key !== "scan_status" && value === true)
    .map(([key]) => '<span class="badge warning">' + escapeHtml(key) + '</span>').join("") || '<span class="badge ok">no declared sensitive capability</span>';

  els.drawerBody.innerHTML =
    '<div class="detail-block"><div class="detail-label">SOURCE</div><a href="' + sourceUrl + '" target="_blank" rel="noreferrer">' + escapeHtml(skill.source.repo) + '</a><div class="muted">' + escapeHtml(skill.source.path) + '</div></div>' +
    '<div class="detail-grid"><div><div class="detail-label">LICENSE</div><strong>' + escapeHtml(skill.license?.spdx ?? "NOASSERTION") + '</strong></div><div><div class="detail-label">DISTRIBUTION</div><strong>' + escapeHtml(skill.distribution) + '</strong></div><div><div class="detail-label">RELEASE</div><strong>' + escapeHtml(skill.release?.status ?? "pending") + '</strong></div><div><div class="detail-label">SECURITY</div><strong>' + escapeHtml(skill.security?.scan_status ?? "pending") + '</strong></div></div>' +
    '<div class="detail-block"><div class="detail-label">CAPABILITIES</div><div class="badges">' + caps + '</div></div>' +
    '<div class="detail-block"><div class="detail-label">COMPATIBILITY</div><div class="badges">' + (skill.compatibility ?? []).map((a) => '<span class="badge">' + escapeHtml(a) + '</span>').join("") + '</div></div>' +
    '<div class="detail-block"><div class="detail-label">INSTALL / BRIDGE</div><code class="command">' + escapeHtml(install) + '</code></div>';
  els.drawer.classList.remove("hidden");
  els.drawer.setAttribute("aria-hidden","false");
}

function closeDrawer() {
  els.drawer.classList.add("hidden");
  els.drawer.setAttribute("aria-hidden","true");
}

[els.search,els.agent,els.distribution,els.category].forEach((el) => {
  el.addEventListener("input",render);
  el.addEventListener("change",render);
});
els.discover.addEventListener("click",runDiscovery);
els.search.addEventListener("keydown",(event) => { if(event.key === "Enter") runDiscovery(); });
els.clear.addEventListener("click",() => {
  els.search.value = "";
  discoveryMode = false;
  skills = catalogSkills;
  els.searchStatus.textContent = "Local registry + remote sources";
  els.agent.value = "";
  els.distribution.value = "";
  els.category.value = "";
  render();
});
els.drawerClose.addEventListener("click",closeDrawer);
els.drawerX.addEventListener("click",closeDrawer);
document.addEventListener("keydown",(event) => {
  if(event.key === "Escape") closeDrawer();
});

load();
