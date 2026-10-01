# Registry Format

A registry entry describes one Skill independently of its upstream repository.

## Required identity
- `id`: stable namespace/path identity
- `name`
- `publisher`
- `source.repo`
- `source.path`

## Trust
- `license.spdx`
- `license.redistributable`
- `license.status`
- `distribution`
- `security`

## Provenance (target shape)
Future generated records should also include:
- `source.revision`: immutable commit SHA
- `source.revision_type`: git-commit
- `source.url`
- `skill_sha256`
- `license_evidence`
- `scanned_at`

The registry is not considered release-ready when a bundled artifact lacks immutable provenance.
