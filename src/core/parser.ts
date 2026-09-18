import LZString from 'lz-string';
import type { ExcalidrawDrawing } from './types.js';

const COMPRESSED_BLOCK = /```compressed-json\s*([\s\S]*?)```/i;
const JSON_BLOCK = /```json\s*([\s\S]*?)```/i;

/** Parse regular Excalidraw JSON or Obsidian Excalidraw markdown. */
export function parseExcalidraw(sourceText: string): ExcalidrawDrawing {
  const compressed = sourceText.match(COMPRESSED_BLOCK)?.[1]?.replace(/\s/g, '');
  let source: string;

  if (compressed) {
    source = LZString.decompressFromBase64(compressed);
    if (!source) throw new Error('Could not decompress the Excalidraw data block.');
  } else {
    source = sourceText.match(JSON_BLOCK)?.[1] ?? sourceText;
  }

  let drawing: ExcalidrawDrawing;
  try {
    drawing = JSON.parse(source) as ExcalidrawDrawing;
  } catch (error) {
    throw new Error(`Invalid Excalidraw JSON: ${(error as Error).message}`);
  }

  if (!Array.isArray(drawing.elements)) {
    throw new Error('The Excalidraw document does not contain an elements array.');
  }

  return {
    ...drawing,
    elements: drawing.elements.filter((element) => !element.isDeleted),
    appState: drawing.appState ?? {},
    files: drawing.files ?? {},
  };
}

/** Backwards-compatible descriptive alias. */
export const parseExcalidrawMarkdown = parseExcalidraw;

export function normalizeLabel(value = ''): string {
  return String(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}
