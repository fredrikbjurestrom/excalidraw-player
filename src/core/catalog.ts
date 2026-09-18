import { normalizeLabel } from './parser.js';
import type {
  ArrowSelector,
  Catalog,
  ExcalidrawDrawing,
  ExcalidrawElementLike,
  ObjectSelector,
  SceneConfig,
  SemanticObject,
} from './types.js';

export class SceneConfigError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Scene configuration contains ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
    this.name = 'SceneConfigError';
    this.errors = errors;
  }
}

function boundText(element: ExcalidrawElementLike, byId: Map<string, ExcalidrawElementLike>) {
  return (element.boundElements ?? [])
    .filter((binding) => binding.type === 'text')
    .map((binding) => byId.get(binding.id))
    .filter((entry): entry is ExcalidrawElementLike => Boolean(entry));
}

function collectBundle(
  primary: ExcalidrawElementLike,
  byId: Map<string, ExcalidrawElementLike>,
  elements: ExcalidrawElementLike[],
): string[] {
  const ids = new Set([primary.id]);
  boundText(primary, byId).forEach((text) => ids.add(text.id));

  for (const groupId of primary.groupIds ?? []) {
    for (const element of elements) {
      if (element.groupIds?.includes(groupId)) {
        ids.add(element.id);
        boundText(element, byId).forEach((text) => ids.add(text.id));
      }
    }
  }

  return elements.filter((element) => ids.has(element.id)).map((element) => element.id);
}

function describe(element: ExcalidrawElementLike, byId: Map<string, ExcalidrawElementLike>): string {
  if (element.type === 'text') return `text “${element.text ?? ''}”`;
  const label = boundText(element, byId)[0]?.text;
  return label ? `${element.type} “${normalizeLabel(label)}”` : `${element.type} ${element.id}`;
}

function resolveTextSelector(
  key: string,
  wantedText: string,
  elements: ExcalidrawElementLike[],
  byId: Map<string, ExcalidrawElementLike>,
): ExcalidrawElementLike {
  const wanted = normalizeLabel(wantedText);
  const matches = elements.filter(
    (element) => element.type === 'text' && normalizeLabel(element.text) === wanted,
  );

  if (matches.length !== 1) {
    throw new Error(`${key}: text selector “${wantedText}” matched ${matches.length} elements; expected 1.`);
  }

  const text = matches[0];
  const primary = text.containerId ? byId.get(text.containerId) : text;
  if (!primary) throw new Error(`${key}: text container ${text.containerId} is missing.`);
  return primary;
}

function referencePrimaryId(reference: string | undefined, resolved: Map<string, SemanticObject>): string | null {
  if (!reference) return null;
  const object = resolved.get(reference);
  if (!object) throw new Error(`references unknown or unresolved object “${reference}”`);
  return object.primaryId;
}

function resolveArrowSelector(
  key: string,
  selector: ArrowSelector,
  elements: ExcalidrawElementLike[],
  byId: Map<string, ExcalidrawElementLike>,
  resolved: Map<string, SemanticObject>,
): ExcalidrawElementLike {
  const spec = selector.arrow;
  let matches = elements.filter((element) => element.type === 'arrow');

  if (spec.label) {
    const wanted = normalizeLabel(spec.label);
    matches = matches.filter((arrow) =>
      boundText(arrow, byId).some((text) => normalizeLabel(text.text) === wanted),
    );
  }

  const from = referencePrimaryId(spec.from, resolved);
  const to = referencePrimaryId(spec.to, resolved);
  if (from) matches = matches.filter((arrow) => arrow.startBinding?.elementId === from);
  if (to) matches = matches.filter((arrow) => arrow.endBinding?.elementId === to);

  if (spec.occurrence) {
    matches = matches[spec.occurrence - 1] ? [matches[spec.occurrence - 1]] : [];
  }

  if (matches.length !== 1) {
    throw new Error(`${key}: arrow selector ${JSON.stringify(spec)} matched ${matches.length} elements; expected 1.`);
  }

  return matches[0];
}

function resolveDefinition(
  key: string,
  sourceDefinition: ObjectSelector,
  elements: ExcalidrawElementLike[],
  byId: Map<string, ExcalidrawElementLike>,
  resolved: Map<string, SemanticObject>,
): SemanticObject {
  const definition = typeof sourceDefinition === 'string' ? { text: sourceDefinition } : sourceDefinition;
  let primary: ExcalidrawElementLike | undefined;

  if ('id' in definition) {
    primary = byId.get(definition.id);
    if (!primary) throw new Error(`${key}: element ID ${definition.id} does not exist.`);
  } else if ('text' in definition) {
    primary = resolveTextSelector(key, definition.text, elements, byId);
  } else if ('arrow' in definition) {
    primary = resolveArrowSelector(key, definition, elements, byId, resolved);
  }

  if (!primary) throw new Error(`${key}: definition needs id, text, or arrow.`);
  const definitionLabel = 'label' in definition ? definition.label : undefined;
  const label = primary.type === 'text'
    ? primary.text ?? key
    : boundText(primary, byId)[0]?.text ?? definitionLabel ?? key;

  return {
    key,
    label: label.replace(/\n/g, ' '),
    type: primary.type,
    primaryId: primary.id,
    elementIds: collectBundle(primary, byId, elements),
  };
}

/** Resolve human-readable object selectors to concrete Excalidraw element bundles. */
export function resolveCatalog(drawing: ExcalidrawDrawing, config: SceneConfig): Catalog {
  const elements = drawing.elements;
  const byId = new Map(elements.map((element) => [element.id, element]));
  const definitions = Object.entries(config.objects ?? {});
  const resolved = new Map<string, SemanticObject>();
  const errors: string[] = [];
  const phases = [
    definitions.filter(([, definition]) => !(typeof definition !== 'string' && 'arrow' in definition)),
    definitions.filter(([, definition]) => typeof definition !== 'string' && 'arrow' in definition),
  ];

  for (const phase of phases) {
    for (const [key, definition] of phase) {
      try {
        resolved.set(key, resolveDefinition(key, definition, elements, byId, resolved));
      } catch (error) {
        errors.push((error as Error).message);
      }
    }
  }

  if (errors.length) throw new SceneConfigError(errors);
  const claimed = new Set([...resolved.values()].flatMap((object) => object.elementIds));
  const unclaimed = elements
    .filter((element) => !claimed.has(element.id))
    .map((element) => ({ id: element.id, type: element.type, description: describe(element, byId) }));

  return { objects: Object.fromEntries(resolved), byId, unclaimed };
}

export function validateTimeline(config: SceneConfig, catalog: Catalog): true {
  const errors: string[] = [];
  const known = new Set(Object.keys(catalog.objects));
  const commands = ['show', 'draw', 'hide', 'dim', 'emphasize'] as const;

  for (const [index, step] of (config.timeline ?? []).entries()) {
    for (const command of commands) {
      for (const key of step[command] ?? []) {
        if (!known.has(key)) errors.push(`step ${index + 1} (${step.name ?? 'unnamed'}): unknown object “${key}”`);
      }
    }
    for (const key of step.focus ?? []) {
      if (!known.has(key)) errors.push(`step ${index + 1} (${step.name ?? 'unnamed'}): unknown focus object “${key}”`);
    }
  }

  if (!config.timeline?.length) errors.push('timeline must contain at least one step.');
  if (errors.length) throw new SceneConfigError(errors);
  return true;
}
