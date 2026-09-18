# Branding guide

Excalidraw Player ships with a neutral theme. A consuming viewer owns all brand assets and overrides.

## Logo and brand name

```html
<excalidraw-player src="/presentation.yaml">
  <img slot="logo" src="/brand/logo.svg" alt="Example organization">
  <span slot="brand">System architecture</span>
</excalidraw-player>
```

The package never fetches or embeds a logo by itself.

## Theme variables

```css
excalidraw-player {
  --edp-accent: #5865f2;
  --edp-accent-soft: #eef0ff;
  --edp-ink: #24262b;
  --edp-muted: #70747d;
  --edp-line: #dfe1e5;
  --edp-background: #f7f7f5;
  --edp-panel: #ffffff;
  --edp-success: #19755d;
  --edp-font: Inter, system-ui, sans-serif;
  --edp-top-border: var(--edp-accent);
}
```

`--edp-top-border` accepts a color or gradient:

```css
excalidraw-player {
  --edp-top-border: linear-gradient(90deg, #c62828 50%, #222 50%);
}
```

## What theme variables do not change

The player theme controls its application chrome: header, timeline, inspector, buttons, and canvas background. Colors and typography inside the drawing remain controlled by the Excalidraw source file.

This separation is intentional:

- presentation chrome belongs to the viewer implementation,
- diagram appearance belongs to the diagram author.

## Audience mode

Omit `inspector` when publishing a viewer:

```html
<excalidraw-player src="/presentation.yaml"></excalidraw-player>
```

The inspector is authoring UI and is not required at runtime.
