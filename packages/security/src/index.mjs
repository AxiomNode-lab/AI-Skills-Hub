const patterns = [
  { type: "shell-execution", regex: /\b(?:bash|sh|zsh|pwsh|powershell)\b|(?:^|\s)(?:sudo|chmod)\b|rm\s+-rf/gi },
  { type: "network-access", regex: /\b(?:curl|wget)\b|https?:\/\//gi },
  { type: "credential-access", regex: /\b(?:api[_ -]?key|access[_ -]?token|secret|credential|process\.env)\b/gi },
  { type: "dynamic-execution", regex: /\b(?:eval|exec|Function)\s*\(/gi },
  { type: "encoded-content", regex: /\bbase64\b|(?:decode|decrypt).*payload/gi },
  { type: "destructive-operation", regex: /\brm\s+-rf\b|\bformat\s+[A-Z]:/gi },
  { type: "package-install", regex: /\b(?:npm|pnpm|yarn|pip|uv|cargo)\s+(?:install|add)\b/gi }
];

export function scanText(text) {
  const findings = [];
  for (const pattern of patterns) {
    const match = pattern.regex.exec(text);
    if (match) findings.push({ type: pattern.type, evidence: match[0].slice(0, 160) });
    pattern.regex.lastIndex = 0;
  }
  return {
    status: "heuristic",
    capabilities: {
      shell: findings.some((f) => f.type === "shell-execution" || f.type === "destructive-operation"),
      network: findings.some((f) => f.type === "network-access"),
      credentials: findings.some((f) => f.type === "credential-access")
    },
    findings
  };
}

export function riskLevel(result) {
  const types = new Set(result.findings.map((f) => f.type));
  if (types.has("destructive-operation") || types.has("dynamic-execution")) return "high";
  if (types.has("credential-access") || types.has("package-install")) return "medium";
  if (result.findings.length) return "low";
  return "none";
}
