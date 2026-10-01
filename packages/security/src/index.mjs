const patterns = [
  { type: "shell-execution", regex: /\b(?:bash|sh|zsh|pwsh|powershell)\b|(?:^|\s)(?:sudo|chmod)\b|\brm\s+-rf\b/gi },
  { type: "network-access", regex: /\b(?:curl|wget)\b|https?:\/\//gi },
  { type: "credential-access", regex: /\b(?:api[_ -]?key|access[_ -]?token|secret|credential|process\.env)\b/gi },
  { type: "dynamic-execution", regex: /\b(?:eval|exec|Function)\s*\(/gi },
  { type: "encoded-content", regex: /\bbase64\b|(?:decode|decrypt).*payload/gi },
  { type: "destructive-operation", regex: /\brm\s+-rf\b|\bformat\s+[A-Z]:/gi },
  { type: "package-install", regex: /\b(?:npm|pnpm|yarn|pip|uv|cargo)\s+(?:install|add)\b/gi },
  { type: "filesystem-write", regex: /\b(?:writeFile|writeFileSync|mkdir|mkdirSync|unlink|unlinkSync|fs\.rm|remove|delete)\b/gi }
];

export function scanText(text) {
  const source = String(text ?? "");
  const lines = source.split(/\r?\n/);
  const findings = [];

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(source)) !== null && findings.length < 200) {
      const before = source.slice(0, match.index);
      const line = before.split(/\r?\n/).length;
      const lineText = lines[line - 1]?.slice(0, 240) ?? "";
      findings.push({
        type: pattern.type,
        line,
        evidence: match[0].slice(0, 160),
        context: lineText
      });
      if (match.index === pattern.regex.lastIndex) pattern.regex.lastIndex += 1;
    }
    pattern.regex.lastIndex = 0;
  }

  findings.sort((a, b) => a.line - b.line || a.type.localeCompare(b.type));

  return {
    status: "heuristic",
    capabilities: {
      shell: findings.some((f) => f.type === "shell-execution" || f.type === "destructive-operation"),
      network: findings.some((f) => f.type === "network-access"),
      credentials: findings.some((f) => f.type === "credential-access"),
      dynamic_execution: findings.some((f) => f.type === "dynamic-execution"),
      package_install: findings.some((f) => f.type === "package-install"),
      filesystem_write: findings.some((f) => f.type === "filesystem-write"),
      encoded_content: findings.some((f) => f.type === "encoded-content")
    },
    findings
  };
}

export function riskLevel(result) {
  const types = new Set((result?.findings ?? []).map((f) => f.type));
  if (types.has("destructive-operation") || types.has("dynamic-execution")) return "high";
  if (types.has("credential-access") || types.has("package-install")) return "medium";
  if (types.has("shell-execution") || types.has("filesystem-write") || types.has("network-access")) return "low";
  if (types.has("encoded-content")) return "low";
  return "none";
}
