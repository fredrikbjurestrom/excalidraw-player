# Excalidraw Player

Turn Excalidraw drawings into animated, step-by-step presentations in any web application. Excalidraw Player is a framework-independent Web Component: install it, register it once in browser code, then point the element at a presentation file.

> This is an independent community package and is not affiliated with or endorsed by Excalidraw.

## Install

Install a tagged release in your application:

```bash
npm install github:fredrikbjurestrom/excalidraw-player#v0.1.0
```

## Add the player

Register the element once, in browser-only application code:

```js
import { defineExcalidrawPlayer } from "excalidraw-player";

defineExcalidrawPlayer();
```

Then add it where the presentation should appear:

```html
<excalidraw-player src="/presentation.yaml"></excalidraw-player>
```

For server-side rendered applications, call `defineExcalidrawPlayer()` only on the client. The element works directly in HTML and in frameworks that support custom elements.

## Provide presentation files

Host the presentation manifest, scene YAML files, and Excalidraw drawings with your application. The `src` URL may point to a presentation manifest or directly to a scene YAML file.

```text
public/
 presentation.yaml
 scene-one.yaml
 scene-one.excalidraw
```

See [examples/basic](examples/basic) for a complete consumer application, and [the API reference](docs/api.md) for attributes, events, methods, slots, and framework integration.

## Customize and control

Use slots to add your own branding:

```html
<excalidraw-player src="/presentation.yaml" autoplay>
 <img slot="logo" src="/logo.svg" alt="Acme" />
 <span slot="brand">Acme architecture</span>
</excalidraw-player>
```

The player can also be controlled from JavaScript:

```js
const player = document.querySelector("excalidraw-player");
await player.goTo(0, 2);
player.play();
```

See [docs/api.md](docs/api.md) for the full API and [docs/configuration.md](docs/configuration.md) for presentation and scene file formats.

## Develop this repository

To run the included demo or work on the package itself, use Node.js 20+ and npm:

```bash
npm install
npm run dev:basic
```

Run the package checks with:

```bash
npm test
npm run build
```

The example uses synthetic architecture data and contains no customer-specific material.

## Demo deployment

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`. It builds and deploys `examples/basic` to GitHub Pages whenever `main` is updated.

After pushing the repository to GitHub:

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` or run the workflow manually from the **Actions** tab.

The example uses relative asset paths so it works when hosted below a repository path such as:

```text
https://fredrikbjurestrom.github.io/excalidraw-player/
```

## License

MIT. Excalidraw and RoughJS are also distributed under MIT licenses. Excalidraw is a trademark of its respective owners.
