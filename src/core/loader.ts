import { parse as parseYaml } from 'yaml';
import { resolveCatalog, validateTimeline } from './catalog.js';
import { parseExcalidraw } from './parser.js';
import type {
  LoadedPresentation,
  LoadedScene,
  PresentationConfig,
  SceneConfig,
  SceneReference,
} from './types.js';

export type FetchText = (url: string) => Promise<string>;

export async function defaultFetchText(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status}`);
  return response.text();
}

export function resolveAssetUrl(relative: string, base: string): string {
  return new URL(relative, base).toString();
}

export function parseStructuredDocument<T>(source: string, sourceName = 'configuration'): T {
  try {
    return parseYaml(source) as T;
  } catch (error) {
    throw new Error(`Could not parse ${sourceName}: ${(error as Error).message}`);
  }
}

function assertSceneConfig(value: unknown, sourceName: string): asserts value is SceneConfig {
  const scene = value as Partial<SceneConfig> | null;
  if (!scene || typeof scene !== 'object') throw new Error(`${sourceName} must contain an object.`);
  if (typeof scene.source !== 'string') throw new Error(`${sourceName} is missing the scene source.`);
  if (!scene.objects || typeof scene.objects !== 'object') throw new Error(`${sourceName} is missing objects.`);
  if (!Array.isArray(scene.timeline)) throw new Error(`${sourceName} is missing timeline.`);
}

function assertPresentationConfig(value: unknown, sourceName: string): asserts value is PresentationConfig {
  const presentation = value as Partial<PresentationConfig> | null;
  if (!presentation || !Array.isArray(presentation.scenes) || !presentation.scenes.length) {
    throw new Error(`${sourceName} must contain at least one scene.`);
  }
  for (const [index, scene] of presentation.scenes.entries()) {
    if (!scene || typeof scene.config !== 'string') {
      throw new Error(`${sourceName}: scene ${index + 1} is missing config.`);
    }
  }
}

/** Load either a presentation manifest or a single scene YAML file. */
export async function loadPresentation(
  sourceUrl: string,
  fetchText: FetchText = defaultFetchText,
): Promise<LoadedPresentation> {
  const absoluteSource = new URL(sourceUrl, globalThis.location?.href ?? 'http://localhost/').toString();
  const document = parseStructuredDocument<PresentationConfig | SceneConfig>(
    await fetchText(absoluteSource),
    absoluteSource,
  );

  if ('scenes' in document) {
    assertPresentationConfig(document, absoluteSource);
    return {
      title: document.title,
      sourceUrl: absoluteSource,
      scenes: document.scenes.map((scene) => ({
        ...scene,
        transition: scene.transition ?? 'fade',
        resolvedConfigUrl: resolveAssetUrl(scene.config, absoluteSource),
      })),
    };
  }

  assertSceneConfig(document, absoluteSource);
  return {
    title: document.title,
    sourceUrl: absoluteSource,
    scenes: [{
      title: document.title,
      config: absoluteSource,
      transition: 'fade',
      resolvedConfigUrl: absoluteSource,
    }],
  };
}

export async function loadScene(
  reference: SceneReference & { resolvedConfigUrl: string },
  fetchText: FetchText = defaultFetchText,
): Promise<LoadedScene> {
  const config = parseStructuredDocument<SceneConfig>(
    await fetchText(reference.resolvedConfigUrl),
    reference.resolvedConfigUrl,
  );
  assertSceneConfig(config, reference.resolvedConfigUrl);
  const drawingUrl = resolveAssetUrl(config.source, reference.resolvedConfigUrl);
  const drawing = parseExcalidraw(await fetchText(drawingUrl));
  const catalog = resolveCatalog(drawing, config);
  validateTimeline(config, catalog);

  return {
    config,
    configUrl: reference.resolvedConfigUrl,
    drawing,
    catalog,
    transition: reference.transition ?? 'fade',
  };
}
