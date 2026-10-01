const redistributable = new Set([
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause",
  "ISC", "MPL-2.0", "CC-BY-4.0", "CC-BY-SA-4.0"
]);

function key(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[(),]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeLicense(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "NOASSERTION";
  const normalized = key(raw);
  const aliases = new Map([
    ["mit", "MIT"],
    ["mit license", "MIT"],
    ["apache 2", "Apache-2.0"],
    ["apache license 2.0", "Apache-2.0"],
    ["apache license version 2.0", "Apache-2.0"],
    ["apache license, version 2.0", "Apache-2.0"],
    ["apache-2.0", "Apache-2.0"],
    ["cc by 4.0", "CC-BY-4.0"],
    ["cc-by-4.0", "CC-BY-4.0"],
    ["cc by-sa 4.0", "CC-BY-SA-4.0"],
    ["cc-by-sa-4.0", "CC-BY-SA-4.0"],
    ["attribution-sharealike 4.0 international", "CC-BY-SA-4.0"],
    ["mozilla public license 2.0", "MPL-2.0"],
    ["mpl-2.0", "MPL-2.0"],
    ["bsd 2-clause", "BSD-2-Clause"],
    ["bsd 3-clause", "BSD-3-Clause"],
    ["isc", "ISC"],
    ["proprietary", "Proprietary"],
    ["all rights reserved", "Proprietary"],
    ["noassertion", "NOASSERTION"]
  ]);
  return aliases.get(normalized) ?? raw;
}

export function classifyLicense(value) {
  const spdx = normalizeLicense(value);
  if (!spdx || spdx === "NOASSERTION" || /unknown|proprietary/i.test(spdx)) {
    return {
      spdx: spdx || "NOASSERTION",
      redistributable: false,
      status: spdx === "Proprietary" ? "verified" : "review-required"
    };
  }
  return {
    spdx,
    redistributable: redistributable.has(spdx),
    status: redistributable.has(spdx) ? "verified" : "review-required"
  };
}
