# Excalidraw Player

A framework-independent Web Component for turning Excalidraw drawings into animated, step-by-step presentations.

This repository contains the reusable package and a neutral example application. The example is also the GitHub Pages demo and a starting point for creating a presentation of your own.

> This is an independent community package and is not affiliated with or endorsed by Excalidraw.

## Requirements

- Node.js 20 or newer
- npm

## Run the example locally

```bash
npm install
npm run dev:basic
```

Open the URL printed by Vite. The example uses synthetic architecture data and contains no customer-specific material.

## Build everything

```bash
npm test
npm run build
npm run pack:player
```

The package tarball contains only the files listed in the root `package.json` `files` field. Examples, tests and source files remain in the repository for documentation and development, but are not included in the package artifact.

## Use the player in another project

The player is a Web Component, so a plain Vite/HTML project is enough. After creating a Vite vanilla project, install a tagged GitHub release:

```bash
npm install github:YOUR_GITHUB_USER/excalidraw-player#v0.1.0
```

Then register and use it:

```js
import { defineExcalidrawPlayer } from "excalidraw-player";

defineExcalidrawPlayer();
```

```html
<excalidraw-player src="/presentation.yaml"></excalidraw-player>
```

Put the presentation manifest, scene YAML and Excalidraw files in the consuming application. See `examples/basic` for a complete minimal application.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`. It builds and deploys `examples/basic` to GitHub Pages whenever `main` is updated.

After pushing the repository to GitHub:

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` or run the workflow manually from the **Actions** tab.

The example uses relative asset paths so it works when hosted below a repository path such as:

```text
https://YOUR_GITHUB_USER.github.io/excalidraw-player/
```

## Repository layout

```text
src/                    Reusable player package source
examples/basic/         Neutral consumer application and demo
docs/                   Package documentation
schemas/                Configuration schemas
tests/                  Generic package tests
```

The root is itself the `excalidraw-player` package. Keeping the package at repository root makes direct GitHub installation straightforward. The examples are workspaces for development, but are excluded from the packaged dependency.

## License

MIT. Excalidraw and RoughJS are also distributed under MIT licenses. Excalidraw is a trademark of its respective owners.
