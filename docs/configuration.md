# Configuration reference

## File model

An Excalidraw Player project has three kinds of files:

1. A **presentation manifest** lists scenes.
2. A **scene configuration** maps semantic names and defines progression.
3. An **Excalidraw drawing** contains the final visual state of one scene.

Paths are resolved relative to the file that contains them.

## Presentation manifest

```yaml
title: System overview
scenes:
  - title: Before
    config: scenes/01-before.scene.yaml
    transition: fade
  - title: After
    config: scenes/02-after.scene.yaml
    transition: fade
```

| Field | Required | Description |
| --- | ---: | --- |
| `title` | No | Presentation title for integrations and metadata. |
| `scenes` | Yes | Non-empty list of scene references. |
| `scenes[].title` | No | Override title used by a surrounding application. |
| `scenes[].config` | Yes | URL to a scene YAML file. |
| `scenes[].transition` | No | `fade` (default) or `none`. |

A scene YAML can be used directly as the player's `src` when only one scene is needed. The standard viewer loads every scene configuration up front so its contents panel can show the complete scene/step tree; SVG rendering remains on demand per scene.

## Scene configuration

```yaml
title: Request flow
source: request-flow.excalidraw.md
objects: {}
timeline: []
```

| Field | Required | Description |
| --- | ---: | --- |
| `title` | No | Scene title displayed by the standard viewer. |
| `source` | Yes | URL to `.excalidraw` or Obsidian `.excalidraw.md`. |
| `objects` | Yes | Semantic-name-to-selector map. |
| `timeline` | Yes | Ordered, non-empty progression steps. |

## Object selectors

### Bound text

The preferred selector for boxes and other labelled containers:

```yaml
objects:
  api:
    text: Orders API
```

The resolver finds exactly one text element and follows its `containerId`. The semantic object includes both the container and its bound text.

Text matching ignores repeated whitespace and line breaks and is case-insensitive. It must still be unique.

### Arrow

```yaml
objects:
  request:
    arrow:
      label: Request
      from: client
      to: api
```

`from` and `to` refer to semantic objects declared in the same scene. Endpoint matching uses Excalidraw bindings rather than geometry.

All arrow fields are optional, but the resulting selector must match exactly one arrow:

```yaml
objects:
  unlabelled-arrow:
    arrow:
      from: api
      to: database
```

For repeated, unbound arrows, `occurrence` provides a last-resort positional selector:

```yaml
  second-arrow:
    arrow:
      label: Update
      occurrence: 2
```

### Explicit element ID

```yaml
objects:
  legacy-arrow:
    id: 4Jx8b7Qe...
```

Use this only when an element has neither a unique label nor usable bindings. IDs change when an element is deleted and recreated.

### String shorthand

```yaml
objects:
  api: Orders API
```

This is equivalent to `{ text: Orders API }`.

## Timeline

```yaml
timeline:
  - name: Show components
    show: [client, api]
    focus: [client, api]

  - name: Send request
    draw: [request]
    hold: 3000
```

Steps are cumulative. A visible object remains visible until `hide` is used.

### Commands

| Command | Description |
| --- | --- |
| `show` | Fades an object bundle into view. |
| `draw` | Draws paths in the primary element, then reveals bound text. |
| `hide` | Fades an object bundle out. |
| `dim` | Reduces opacity and saturation. |
| `emphasize` | Removes dimming and pulses the object. |
| `focus` | Moves the SVG viewBox to include the selected objects. |

### Timing

| Field | Default | Description |
| --- | ---: | --- |
| `drawDuration` | `620` | Milliseconds per arrow in `draw`. |
| `focusPadding` | `90` | Excalidraw scene units around focused objects. |
| `hold` | `2300` | Milliseconds before autoplay advances. |

Arrows listed in one `draw` command are drawn sequentially.

## Authoring recommendations

- Give nodes and arrows short, unique visible labels.
- Keep arrow labels bound to their arrows.
- Keep arrows bound to their source and target boxes.
- Group decorative elements with the logical node they belong to.
- Keep all elements needed by a scene in its Excalidraw file; reveal them through the timeline.
- Use a new Excalidraw file for a major layout change.
- Reuse the same semantic names in multiple scenes for future matched transitions.

## Validation

Loading fails rather than guessing when:

- a text selector has zero or multiple matches,
- an arrow selector has zero or multiple matches,
- `from` or `to` references an unknown semantic object,
- a timeline command references an unknown semantic object,
- a scene has no timeline steps.
