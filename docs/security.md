# Security and LLM authoring

## Configuration is data, not instructions

Excalidraw Player consumes YAML/JSON configuration and Excalidraw data. It does not consume `AGENTS.md`, prompt files, or natural-language agent instructions at runtime.

The player does not use `eval`, `Function`, inline JavaScript from YAML, or executable transition expressions. Timeline commands are restricted to the documented command set.

Do not distribute agent instruction files as part of a presentation package. They are unnecessary for the viewer and may be interpreted as trusted instructions by unrelated automation.

## Using an LLM while authoring

An LLM can be useful for editing scene YAML, but should be treated as an untrusted authoring assistant:

1. Give it only the diagram and configuration needed for the task.
2. Review the generated diff.
3. Run parser and selector validation.
4. Preview the presentation.
5. Commit the resulting YAML, not an undocumented chat state.

The YAML files remain the source of truth. A presentation must render identically without access to the authoring LLM.

## Network behavior

The standard loader fetches only:

- the URL in the player's `src` attribute,
- scene configuration URLs listed by that manifest,
- drawing URLs listed by scene configurations.

Normal browser same-origin and CORS policies apply. Use trusted configuration files: a manifest can point the browser at additional URLs allowed by its CORS policy.

The player does not upload diagrams or configuration to a service.

## Excalidraw content

Rendering is delegated to `@excalidraw/utils`. Original element links are replaced on an in-memory clone to establish SVG element identity and are removed from the rendered SVG. Embedded web content is not enabled by the player.

As with other static-site assets, sanitize and review untrusted drawings before hosting them publicly, especially drawings containing embedded files or links.

## Dependency and release checks

Before release:

```bash
npm audit --omit=dev
npm test
npm run build
npm pack --dry-run
```

Inspect the package tarball contents and lock dependency versions for reproducible builds.
