# Installation

## Preview

~~~bash
skills-hub plan @core --agent codex
~~~

## Native installation

Verified and materialized Skills can be installed locally without resolving a moving upstream branch:

~~~bash
skills-hub install @core --agent codex --scope project
~~~

Supported target roots are adapter-defined. The current portable-first mapping uses project .agents/skills where the target supports it, with client-specific fallbacks such as .claude/skills, .cursor/skills, and .github/skills.

User-scope installation is supported by the adapter layer.

The installer refuses non-materialized artifacts. For bundled-but-not-yet-materialized Skills it reports a source bridge in the plan instead of silently pretending local reproducible content is available.

Source-direct and review-required Skills are not silently mirrored or executed.
