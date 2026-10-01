# Security Model

A Skill is treated as executable guidance, not inert documentation.

We track capabilities such as:
- shell execution
- network access
- credential/environment access
- package installation
- file-system writes
- external API usage

Future scanner stages will inspect scripts, references, URLs, commands, package manifests, and encoded payloads. Findings must be explainable and attributable to concrete source content.
