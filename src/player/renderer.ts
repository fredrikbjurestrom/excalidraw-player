import type { ExcalidrawDrawing, SemanticObject } from '../core/types.js';

const ELEMENT_LINK_PREFIX = 'https://animation.invalid/element/';

function clone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

/** Render with Excalidraw itself, while adding temporary links to recover element IDs in the SVG. */
export async function renderAnnotatedSvg(drawing: ExcalidrawDrawing): Promise<SVGSVGElement> {
  const elements = clone(drawing.elements).map((element) => ({
    ...element,
    link: `${ELEMENT_LINK_PREFIX}${encodeURIComponent(element.id)}`,
  }));

  // Loaded lazily so importing the package remains safe in SSR and Node tooling.
  const { exportToSvg } = await import('@excalidraw/utils');
  const svg = await exportToSvg({
    data: {
      elements: elements as never,
      appState: {
        ...clone(drawing.appState),
        exportBackground: false,
        exportWithDarkMode: false,
        viewBackgroundColor: '#ffffff',
      } as never,
      files: clone(drawing.files) as never,
    },
    config: {
      padding: 24,
      theme: 'light',
      canvasBackgroundColor: '#ffffff',
      exportingFrame: null,
    },
  });

  // Chromium does not reliably register SVG @font-face rules inside a shadow root.
  // Promote the active SVG's generated (and character-subsetted) font rules to
  // the document. This must be refreshed for every scene: different scenes may
  // use different font families or different glyph subsets of the same family.
  const fontCss = [...svg.querySelectorAll('style')]
    .map((style) => style.textContent ?? '')
    .filter((css) => css.includes('@font-face'))
    .join('\n');
  if (fontCss) {
    let globalFonts = document.head.querySelector<HTMLStyleElement>(
      'style[data-excalidraw-player-fonts]',
    );
    if (!globalFonts) {
      globalFonts = document.createElement('style');
      globalFonts.dataset.excalidrawPlayerFonts = '';
      document.head.appendChild(globalFonts);
    }
    globalFonts.textContent = fontCss;
  }

  svg.classList.add('edp-drawing-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.removeAttribute('width');
  svg.removeAttribute('height');

  for (const anchor of svg.querySelectorAll('a')) {
    const href = anchor.getAttribute('href') ?? anchor.getAttribute('xlink:href') ?? '';
    const marker = '/element/';
    const markerAt = href.indexOf(marker);
    if (markerAt < 0) continue;
    const id = decodeURIComponent(href.slice(markerAt + marker.length));
    anchor.dataset.elementId = id;
    anchor.classList.add('edp-element');
    anchor.removeAttribute('href');
    anchor.removeAttribute('xlink:href');
  }

  return svg;
}

export function elementNode(svg: SVGSVGElement, id: string): SVGAElement | null {
  return [...svg.querySelectorAll<SVGAElement>('.edp-element')]
    .find((node) => node.dataset.elementId === id) ?? null;
}

export function objectNodes(svg: SVGSVGElement, object: SemanticObject): SVGAElement[] {
  return object.elementIds.map((id) => elementNode(svg, id)).filter((node): node is SVGAElement => Boolean(node));
}

export function setObjectVisible(
  svg: SVGSVGElement,
  object: SemanticObject,
  visible: boolean,
  options: { immediate?: boolean } = {},
): void {
  for (const node of objectNodes(svg, object)) {
    node.classList.toggle('edp-visible', visible);
    node.classList.toggle('edp-no-transition', options.immediate ?? false);
  }
  if (options.immediate) requestAnimationFrame(() => {
    objectNodes(svg, object).forEach((node) => node.classList.remove('edp-no-transition'));
  });
}

export function setObjectDimmed(svg: SVGSVGElement, object: SemanticObject, dimmed: boolean): void {
  objectNodes(svg, object).forEach((node) => node.classList.toggle('edp-dimmed', dimmed));
}

export async function drawObject(svg: SVGSVGElement, object: SemanticObject, duration = 700): Promise<void> {
  const [primaryId, ...secondaryIds] = object.elementIds;
  const primary = elementNode(svg, primaryId);
  if (!primary) return;

  primary.classList.add('edp-visible');
  const paths = [...primary.querySelectorAll<SVGPathElement>('path')].filter((path) => {
    try { return path.getTotalLength() > 1; } catch { return false; }
  });
  const animations = paths.map((path) => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length + 2}`;
    path.style.strokeDashoffset = `${length + 2}`;
    return path.animate(
      [{ strokeDashoffset: length + 2 }, { strokeDashoffset: 0 }],
      { duration, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' },
    ).finished.catch(() => undefined);
  });

  await new Promise((resolve) => setTimeout(resolve, Math.round(duration * .6)));
  secondaryIds.forEach((id) => elementNode(svg, id)?.classList.add('edp-visible'));
  await Promise.all(animations);
  paths.forEach((path) => {
    path.style.strokeDasharray = '';
    path.style.strokeDashoffset = '';
  });
}

export function pulseObject(svg: SVGSVGElement, object: SemanticObject): void {
  for (const node of objectNodes(svg, object)) {
    node.animate(
      [
        { filter: 'drop-shadow(0 0 0 color-mix(in srgb, var(--edp-accent) 0%, transparent))' },
        { filter: 'drop-shadow(0 0 8px var(--edp-accent))' },
        { filter: 'drop-shadow(0 0 0 color-mix(in srgb, var(--edp-accent) 0%, transparent))' },
      ],
      { duration: 900, easing: 'ease-out' },
    );
  }
}

type ViewBox = { x: number; y: number; width: number; height: number };
const focusVersions = new WeakMap<SVGSVGElement, number>();

function unionBounds(nodes: SVGAElement[]): ViewBox | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const node of nodes) {
    const box = node.getBBox();
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.width);
    bottom = Math.max(bottom, box.y + box.height);
  }
  return Number.isFinite(left) ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

function fitAspect(box: ViewBox, aspect: number, padding: number): ViewBox {
  let width = Math.max(1, box.width + padding * 2);
  let height = Math.max(1, box.height + padding * 2);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  if (width / height > aspect) height = width / aspect;
  else width = height * aspect;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

function parseViewBox(svg: SVGSVGElement): ViewBox {
  const values = (svg.getAttribute('viewBox') ?? '0 0 1 1').split(/\s+/).map(Number);
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

function setViewBox(svg: SVGSVGElement, box: ViewBox): void {
  svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
}

export function focusObjects(
  svg: SVGSVGElement,
  objects: SemanticObject[],
  options: { padding?: number; duration?: number } = {},
): void {
  const bounds = unionBounds(objects.flatMap((object) => objectNodes(svg, object)));
  if (!bounds) return;
  const from = parseViewBox(svg);
  const aspect = svg.clientWidth && svg.clientHeight ? svg.clientWidth / svg.clientHeight : from.width / from.height;
  const to = fitAspect(bounds, aspect, options.padding ?? 80);
  const duration = options.duration ?? 650;
  const version = (focusVersions.get(svg) ?? 0) + 1;
  focusVersions.set(svg, version);
  if (duration <= 1) {
    setViewBox(svg, to);
    return;
  }

  const started = performance.now();
  function frame(now: number) {
    if (focusVersions.get(svg) !== version) return;
    const progress = Math.min(1, (now - started) / duration);
    const amount = 1 - Math.pow(1 - progress, 3);
    setViewBox(svg, {
      x: from.x + (to.x - from.x) * amount,
      y: from.y + (to.y - from.y) * amount,
      width: from.width + (to.width - from.width) * amount,
      height: from.height + (to.height - from.height) * amount,
    });
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
