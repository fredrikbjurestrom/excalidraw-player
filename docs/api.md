# API reference

## Register the Web Component

```js
import { defineExcalidrawPlayer } from "excalidraw-player";
defineExcalidrawPlayer();
```

A custom tag name is supported:

```js
defineExcalidrawPlayer("architecture-player");
```

Registration is idempotent. Importing the package does not modify `customElements` automatically.

## `<excalidraw-player>`

### Attributes

#### `src`

URL to a presentation manifest or scene YAML. Changing it reloads the player.

#### `inspector`

Boolean attribute that exposes the development inspector.

#### `autoplay`

Boolean attribute that starts playback after `playerready`.

#### `hide-menu`

Boolean attribute that starts with the complete scene/step navigation tree collapsed.

### Slots

| Slot | Fallback | Purpose |
| --- | --- | --- |
| `logo` | Accent-colored `E` mark | Logo or icon in the header. |
| `brand` | `Excalidraw Player` | Product, project, or organization name. |

### Properties

#### `src: string`

Reflects the `src` attribute.

#### `position: { sceneIndex: number; stepIndex: number }`

Current zero-based position. Read-only.

### Methods

#### `load(source?: string): Promise<void>`

Reload the current source or load another source URL.

#### `goTo(sceneIndex, stepIndex, animate = true): Promise<void>`

Navigate to a scene and step. Set `animate` to `false` for deterministic screenshots or initial deep links.

#### `next(): Promise<void>`

Advance one step, or enter the next scene when the current timeline is complete.

#### `previous(): Promise<void>`

Go back one step, or to the final step of the previous scene.

#### `play(): void` / `pause(): void`

Control autoplay.

#### `toggleMenu(force?: boolean): void`

Toggle the complete scene/step tree. Pass `true` to hide it or `false` to show it.

### Events

Events are dispatched on the custom element.

| Event | `detail` |
| --- | --- |
| `playerready` | Current position after initial load. |
| `scenechange` | New position after changing scene. |
| `stepchange` | New position after changing step. |
| `playererror` | The caught `Error`. |

### Keyboard controls

The player host is focusable.

| Key | Action |
| --- | --- |
| `ArrowRight`, `PageDown` | Next step |
| `ArrowLeft`, `PageUp` | Previous step |
| `Space` | Play/pause |
| `M` | Toggle the complete scene/step menu |
| `I` | Toggle inspector when enabled |
| `R` | Reload source files |
| `F` | Enter or leave browser fullscreen |

## Core API

Import without the Web Component:

```js
import {
  parseExcalidraw,
  resolveCatalog,
  validateTimeline,
  loadPresentation,
  loadScene,
} from "excalidraw-player/core";
```

### `parseExcalidraw(sourceText)`

Accepts:

- regular Excalidraw JSON,
- a raw JSON fenced block,
- Obsidian Excalidraw Plugin markdown containing `compressed-json`.

Deleted elements are filtered out.

### `resolveCatalog(drawing, sceneConfig)`

Returns:

```ts
{
  objects: Record<string, SemanticObject>;
  byId: Map<string, ExcalidrawElementLike>;
  unclaimed: Array<{ id: string; type: string; description: string }>;
}
```

Each semantic object contains its primary Excalidraw ID and all bound/grouped element IDs.

### `validateTimeline(sceneConfig, catalog)`

Throws `SceneConfigError` if timeline references cannot be resolved.

### `loadPresentation(sourceUrl, fetchText?)`

Loads a presentation manifest or wraps a single scene file as a one-scene presentation. `fetchText` can be injected for tests or non-browser environments.

### `loadScene(reference, fetchText?)`

Loads scene configuration and drawing, then resolves and validates its catalog.

## Framework usage

Because the standard UI is a Web Component, it can be used directly in most frameworks. Ensure the component is registered once in browser code. When using server-side rendering, call `defineExcalidrawPlayer` only on the client.
