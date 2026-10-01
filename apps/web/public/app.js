const API = window.AI_SKILLS_API_URL || "/api";
const response = await fetch(API + "/api/skills").catch(() => null);
const registry = response ? await response.json() : {skills:[]};
const skills = registry.skills ?? [];
const skillsEl = document.querySelector("#skills");
const search = document.querySelector("#search");
const stats = document.querySelector("#stats");
const count = document.querySelector("#count");

const groups = {
  total: skills.length,
  bundled: skills.filter((s) => s.distribution === "bundled").length,
  direct: skills.filter((s) => s.distribution === "source-direct").length,
  review: skills.filter((s) => s.distribution === "review-required").length
};

stats.innerHTML = [["total","Skills"],["bundled","Bundled"],["direct","Source-direct"],["review","Review"]]
  .map(([key,label]) => '<div class="stat"><strong>' + groups[key] + '</strong><span>' + label + '</span></div>')
  .join("");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);
}

function render() {
  const q = search.value.trim().toLowerCase();
  const items = skills.filter((s) =>
    !q || [s.id,s.name,s.publisher,...s.category].join(" ").toLowerCase().includes(q)
  );
  count.textContent = items.length + " results";
  skillsEl.innerHTML = items.map((s) => {
    const chips = s.category.map((c) => '<span class="chip">' + escapeHtml(c) + '</span>').join("");
    const risk = escapeHtml(s.security.risk ?? "pending");
    const release = escapeHtml(s.release?.status ?? "pending");
    return '<article class="card"><h3>' + escapeHtml(s.name) + '</h3>' +
      '<div class="meta">' + escapeHtml(s.publisher) + ' · ' + escapeHtml(s.license.spdx) + '</div>' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="badges"><span class="badge">' + escapeHtml(s.distribution) + '</span>' +
      '<span class="badge">' + release + '</span><span class="badge">risk:' + risk + '</span></div></article>';
  }).join("");
}
search.addEventListener("input",render);
render();
