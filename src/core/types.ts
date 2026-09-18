export type ExcalidrawElementLike = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  text?: string;
  containerId?: string | null;
  groupIds?: string[];
  boundElements?: Array<{ id: string; type: string }> | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  isDeleted?: boolean;
  link?: string | null;
  [key: string]: unknown;
};

export type ExcalidrawDrawing = {
  type: string;
  version?: number;
  source?: string;
  elements: ExcalidrawElementLike[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

export type TextSelector = { text: string; label?: string };
export type IdSelector = { id: string; label?: string };
export type ArrowSelector = {
  arrow: {
    label?: string;
    from?: string;
    to?: string;
    occurrence?: number;
  };
  label?: string;
};
export type ObjectSelector = string | TextSelector | IdSelector | ArrowSelector;

export type TimelineStep = {
  name?: string;
  show?: string[];
  draw?: string[];
  hide?: string[];
  dim?: string[];
  emphasize?: string[];
  focus?: string[];
  drawDuration?: number;
  focusPadding?: number;
  hold?: number;
};

export type SceneConfig = {
  title?: string;
  source: string;
  objects: Record<string, ObjectSelector>;
  timeline: TimelineStep[];
};

export type SceneReference = {
  title?: string;
  config: string;
  transition?: 'fade' | 'none';
};

export type PresentationConfig = {
  title?: string;
  scenes: SceneReference[];
};

export type SemanticObject = {
  key: string;
  label: string;
  type: string;
  primaryId: string;
  elementIds: string[];
};

export type Catalog = {
  objects: Record<string, SemanticObject>;
  byId: Map<string, ExcalidrawElementLike>;
  unclaimed: Array<{ id: string; type: string; description: string }>;
};

export type LoadedScene = {
  config: SceneConfig;
  configUrl: string;
  drawing: ExcalidrawDrawing;
  catalog: Catalog;
  transition: 'fade' | 'none';
};

export type LoadedPresentation = {
  title?: string;
  sourceUrl: string;
  scenes: Array<SceneReference & { resolvedConfigUrl: string }>;
};
