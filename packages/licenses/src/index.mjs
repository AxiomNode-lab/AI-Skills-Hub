const redistributable = new Set([
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause",
  "ISC", "MPL-2.0", "CC-BY-4.0", "CC-BY-SA-4.0"
]);

export function normalizeLicense(value) {
  const raw = String(value ?? "").trim();
  const aliases = new Map([
    ["Apache License 2.0", "Apache-2.0"],
    ["Apache 2", "Apache-2.0"],
    ["MIT License", "MIT"],
    ["CC BY-SA 4.0", "CC-BY-SA-4.0"],
    ["Attribution-ShareAlike 4.0 International", "CC-BY-SA-4.0"]
  ]);
  return aliases.get(raw) ?? raw;
}

export function classifyLicense(value) {
  const spdx = normalizeLicense(value);
  if (!spdx || /unknown|noassertion/i.test(spdx)) {
    return { spdx: "NOASSERTION", redistributable: false, status: "review-required" };
  }
  return {
    spdx,
    redistributable: redistributable.has(spdx),
    status: redistributable.has(spdx) ? "verified" : "review-required"
  };
}
