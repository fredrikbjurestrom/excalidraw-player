import { loadPresentation, loadScene } from '../core/loader.js';
import type { LoadedPresentation, LoadedScene } from '../core/types.js';
import {
  drawObject,
  focusObjects,
  objectNodes,
  pulseObject,
  renderAnnotatedSvg,
  setObjectDimmed,
  setObjectVisible,
} from './renderer.js';
import styles from './styles.css?inline';

const HTMLElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

type SceneState = { visible: Set<string>; dimmed: Set<string> };

export type PlayerPosition = { sceneIndex: number; stepIndex: number };

export class ExcalidrawPlayerElement extends HTMLElementBase {
  static observedAttributes = ['src', 'inspector', 'hide-menu'];

  #shadow?: ShadowRoot;
  #presentation?: LoadedPresentation;
  #scene?: LoadedScene;
  #loadedScenes: LoadedScene[] = [];
  #svg?: SVGSVGElement;
  #sceneCache = new Map<number, Promise<LoadedScene>>();
  #sceneIndex = 0;
  #stepIndex = 0;
  #navigationToken = 0;
  #playing = false;
  #playTimer?: number;

  connectedCallback(): void {
    if (!this.#shadow) this.#renderShell();
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    requestAnimationFrame(() => this.focus({ preventScroll: true }));
    void this.load();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.isConnected || oldValue === newValue) return;
    if (name === 'src') void this.load();
    if (name === 'inspector') this.#syncInspectorAvailability();
    if (name === 'hide-menu') this.#syncMenuState();
  }

  get src(): string {
    return this.getAttribute('src') ?? '';
  }

  set src(value: string) {
    this.setAttribute('src', value);
  }

  get position(): PlayerPosition {
    return { sceneIndex: this.#sceneIndex, stepIndex: this.#stepIndex };
  }

  toggleMenu(force?: boolean): void {
    const hidden = force ?? !this.hasAttribute('hide-menu');
    this.toggleAttribute('hide-menu', hidden);
    this.#syncMenuState();
    globalThis.setTimeout(() => this.#focusCurrentStep(240), 300);
  }

  async load(source = this.src): Promise<void> {
    if (!this.#shadow) this.#renderShell();
    if (!source) {
      this.#showError('Set the src attribute to a presentation or scene YAML file.');
      return;
    }

    this.pause();
    this.#sceneCache.clear();
    this.#loadedScenes = [];
    this.#showStatus('Loading presentation…');
    try {
      this.#presentation = await loadPresentation(source);
      this.#sceneIndex = 0;
      this.#stepIndex = 0;
      this.#loadedScenes = await Promise.all(
        this.#presentation.scenes.map((_, index) => this.#getScene(index)),
      );
      this.#renderNavigationTree();
      await this.#activateScene(0, 0, false);
      this.dispatchEvent(new CustomEvent('playerready', { detail: this.position, bubbles: true, composed: true }));
      if (this.hasAttribute('autoplay')) this.play();
    } catch (error) {
      this.#showError((error as Error).message);
      this.dispatchEvent(new CustomEvent('playererror', { detail: error, bubbles: true, composed: true }));
    }
  }

  async goTo(sceneIndex: number, stepIndex: number, animate = true): Promise<void> {
    if (!this.#presentation) return;
    const boundedScene = Math.max(0, Math.min(this.#presentation.scenes.length - 1, sceneIndex));
    if (boundedScene !== this.#sceneIndex || !this.#scene) {
      await this.#activateScene(boundedScene, stepIndex, animate);
      return;
    }
    await this.#activateStep(stepIndex, animate);
  }

  async next(): Promise<void> {
    if (!this.#presentation || !this.#scene) return;
    if (this.#stepIndex < this.#scene.config.timeline.length - 1) {
      await this.#activateStep(this.#stepIndex + 1);
    } else if (this.#sceneIndex < this.#presentation.scenes.length - 1) {
      await this.#activateScene(this.#sceneIndex + 1, 0, true);
    } else {
      this.pause();
    }
  }

  async previous(): Promise<void> {
    if (!this.#presentation || !this.#scene) return;
    if (this.#stepIndex > 0) {
      await this.#activateStep(this.#stepIndex - 1);
    } else if (this.#sceneIndex > 0) {
      const previousScene = await this.#getScene(this.#sceneIndex - 1);
      await this.#activateScene(this.#sceneIndex - 1, previousScene.config.timeline.length - 1, true);
    }
  }

  play(): void {
    this.#playing = true;
    this.#button('play').textContent = 'Ⅱ';
    void this.#activateStep(this.#stepIndex);
  }

  pause(): void {
    this.#playing = false;
    globalThis.clearTimeout(this.#playTimer);
    if (this.#shadow) this.#button('play').textContent = '▶';
  }

  #renderShell(): void {
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = `
      <style>${styles}</style>
      <section class="edp-player">
        <header class="edp-header">
          <div class="edp-brand">
            <slot name="logo"><span class="edp-default-logo">E</span></slot>
            <slot name="brand"><strong>Excalidraw Player</strong></slot>
          </div>
          <div class="edp-scene-meta"><strong data-ref="sceneTitle"></strong><span data-ref="sceneCounter"></span></div>
          <div class="edp-actions">
            <button data-action="menu" title="Toggle contents (M)">☰ Contents</button>
            <button data-action="reload" title="Reload (R)">↻</button>
            <button data-action="inspector" title="Inspect semantic objects (I)">Inspect</button>
            <button data-action="fullscreen" title="Fullscreen (F)">Fullscreen</button>
          </div>
        </header>
        <div class="edp-workspace">
          <aside class="edp-timeline"><div class="edp-panel-title"><span>CONTENTS</span><b data-ref="treeCounter"></b></div><nav data-ref="steps"></nav></aside>
          <div class="edp-canvas" data-ref="canvas"><div class="edp-status" data-ref="status">Loading…</div><pre class="edp-error" data-ref="error" hidden></pre></div>
          <aside class="edp-inspector" data-ref="inspector"><div class="edp-panel-title"><span>SEMANTIC OBJECTS</span><b data-ref="objectCount"></b></div><p>Names remain stable even when Excalidraw IDs change.</p><div data-ref="objects"></div></aside>
        </div>
        <footer class="edp-footer">
          <div class="edp-transport"><button data-action="previous">←</button><button class="edp-play" data-action="play">▶</button><button data-action="next">→</button></div>
          <div class="edp-now"><span>NOW</span><b data-ref="currentStep"></b></div>
          <div class="edp-hint">← → steps · Space play · M menu · I inspect · F fullscreen</div>
        </footer>
      </section>`;

    this.#button('previous').addEventListener('click', () => void this.previous());
    this.#button('next').addEventListener('click', () => void this.next());
    this.#button('play').addEventListener('click', () => this.#playing ? this.pause() : this.play());
    this.#button('menu').addEventListener('click', () => this.toggleMenu());
    this.#button('reload').addEventListener('click', () => void this.load());
    this.#button('fullscreen').addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void this.requestFullscreen();
      globalThis.setTimeout(() => this.#focusCurrentStep(240), 300);
    });
    this.#button('inspector').addEventListener('click', () => this.#ref('inspector').classList.toggle('edp-open'));
    this.addEventListener('keydown', (event) => this.#onKeydown(event));
    this.#syncInspectorAvailability();
    this.#syncMenuState();
  }

  #onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') void this.next();
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') void this.previous();
    if (event.key === ' ') { event.preventDefault(); this.#playing ? this.pause() : this.play(); }
    if (event.key.toLowerCase() === 'm') this.toggleMenu();
    if (event.key.toLowerCase() === 'i' && this.hasAttribute('inspector')) this.#button('inspector').click();
    if (event.key.toLowerCase() === 'r') void this.load();
    if (event.key.toLowerCase() === 'f') this.#button('fullscreen').click();
  }

  #syncInspectorAvailability(): void {
    if (!this.#shadow) return;
    const enabled = this.hasAttribute('inspector');
    this.#button('inspector').hidden = !enabled;
    if (!enabled) this.#ref('inspector').classList.remove('edp-open');
  }

  #syncMenuState(): void {
    if (!this.#shadow) return;
    const hidden = this.hasAttribute('hide-menu');
    this.#shadow.querySelector('.edp-player')?.classList.toggle('edp-menu-hidden', hidden);
    this.#button('menu').classList.toggle('edp-active', !hidden);
    this.#button('menu').setAttribute('aria-pressed', String(!hidden));
  }

  #focusCurrentStep(duration = 1): void {
    if (!this.#scene || !this.#svg) return;
    const focus = this.#scene.config.timeline[this.#stepIndex]?.focus;
    if (!focus?.length) return;
    focusObjects(this.#svg, focus.map((key) => this.#scene!.catalog.objects[key]), {
      padding: this.#scene.config.timeline[this.#stepIndex]?.focusPadding ?? 90,
      duration,
    });
  }

  async #getScene(index: number): Promise<LoadedScene> {
    const cached = this.#sceneCache.get(index);
    if (cached) return cached;
    const reference = this.#presentation?.scenes[index];
    if (!reference) throw new Error(`Scene ${index + 1} does not exist.`);
    const promise = loadScene(reference);
    this.#sceneCache.set(index, promise);
    return promise;
  }

  async #activateScene(index: number, stepIndex: number, animate: boolean): Promise<void> {
    const token = ++this.#navigationToken;
    const canvas = this.#ref('canvas');
    const shouldFade = animate && this.#presentation?.scenes[index]?.transition !== 'none';
    if (shouldFade) canvas.classList.add('edp-switching');
    this.#showStatus(`Loading scene ${index + 1}…`);

    const scene = await this.#getScene(index);
    const svg = await renderAnnotatedSvg(scene.drawing);
    if (token !== this.#navigationToken) return;

    this.#svg?.remove();
    canvas.prepend(svg);
    this.#svg = svg;
    this.#scene = scene;
    this.#sceneIndex = index;
    this.#renderInspector();
    this.#hideStatus();
    await this.#activateStep(stepIndex, false);
    if (shouldFade) requestAnimationFrame(() => canvas.classList.remove('edp-switching'));
    this.dispatchEvent(new CustomEvent('scenechange', { detail: this.position, bubbles: true, composed: true }));
  }

  #stateAt(index: number): SceneState {
    const visible = new Set<string>();
    const dimmed = new Set<string>();
    for (const step of this.#scene?.config.timeline.slice(0, index + 1) ?? []) {
      for (const key of [...(step.show ?? []), ...(step.draw ?? [])]) visible.add(key);
      for (const key of step.hide ?? []) { visible.delete(key); dimmed.delete(key); }
      for (const key of step.dim ?? []) dimmed.add(key);
      for (const key of step.emphasize ?? []) dimmed.delete(key);
    }
    return { visible, dimmed };
  }

  #applyState(state: SceneState): void {
    if (!this.#scene || !this.#svg) return;
    for (const [key, object] of Object.entries(this.#scene.catalog.objects)) {
      setObjectVisible(this.#svg, object, state.visible.has(key), { immediate: true });
      setObjectDimmed(this.#svg, object, state.dimmed.has(key));
    }
  }

  async #activateStep(index: number, animate = true): Promise<void> {
    if (!this.#scene || !this.#svg) return;
    const token = ++this.#navigationToken;
    globalThis.clearTimeout(this.#playTimer);
    index = Math.max(0, Math.min(this.#scene.config.timeline.length - 1, index));
    this.#applyState(this.#stateAt(index - 1));
    this.#stepIndex = index;
    this.#updateUi();
    const step = this.#scene.config.timeline[index];

    if (!animate) {
      this.#applyState(this.#stateAt(index));
    } else {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      for (const key of step.show ?? []) setObjectVisible(this.#svg, this.#scene.catalog.objects[key], true);
      for (const key of step.hide ?? []) setObjectVisible(this.#svg, this.#scene.catalog.objects[key], false);
      for (const key of step.dim ?? []) setObjectDimmed(this.#svg, this.#scene.catalog.objects[key], true);
      for (const key of step.emphasize ?? []) {
        setObjectDimmed(this.#svg, this.#scene.catalog.objects[key], false);
        pulseObject(this.#svg, this.#scene.catalog.objects[key]);
      }
      for (const key of step.draw ?? []) {
        if (token !== this.#navigationToken) return;
        await drawObject(this.#svg, this.#scene.catalog.objects[key], step.drawDuration ?? 620);
      }
    }

    if (step.focus?.length) {
      focusObjects(this.#svg, step.focus.map((key) => this.#scene!.catalog.objects[key]), {
        padding: step.focusPadding ?? 90,
        duration: animate ? 700 : 1,
      });
    }

    this.dispatchEvent(new CustomEvent('stepchange', { detail: this.position, bubbles: true, composed: true }));
    if (this.#playing && token === this.#navigationToken) {
      this.#playTimer = globalThis.setTimeout(() => void this.next(), step.hold ?? 2300);
    }
  }

  #renderNavigationTree(): void {
    const container = this.#ref('steps');
    const sceneGroups = this.#loadedScenes.map((scene, sceneIndex) => {
      const group = document.createElement('section');
      group.className = 'edp-tree-scene';
      group.dataset.sceneIndex = String(sceneIndex);

      const sceneButton = document.createElement('button');
      sceneButton.className = 'edp-scene-link';
      sceneButton.dataset.sceneIndex = String(sceneIndex);
      const number = document.createElement('span');
      number.textContent = String(sceneIndex + 1).padStart(2, '0');
      const title = document.createElement('b');
      title.textContent = scene.config.title
        ?? this.#presentation?.scenes[sceneIndex]?.title
        ?? `Scene ${sceneIndex + 1}`;
      sceneButton.append(number, title);
      sceneButton.addEventListener('click', () => void this.goTo(sceneIndex, 0));

      const steps = document.createElement('div');
      steps.className = 'edp-scene-steps';
      scene.config.timeline.forEach((step, stepIndex) => {
        const button = document.createElement('button');
        button.className = 'edp-step';
        button.dataset.sceneIndex = String(sceneIndex);
        button.dataset.stepIndex = String(stepIndex);
        const stepNumber = document.createElement('span');
        stepNumber.textContent = String(stepIndex + 1).padStart(2, '0');
        const stepTitle = document.createElement('b');
        stepTitle.textContent = step.name ?? `Step ${stepIndex + 1}`;
        button.append(stepNumber, stepTitle);
        button.addEventListener('click', () => void this.goTo(sceneIndex, stepIndex));
        steps.append(button);
      });

      group.append(sceneButton, steps);
      return group;
    });
    container.replaceChildren(...sceneGroups);
    this.#ref('treeCounter').textContent = `${this.#loadedScenes.length} scene${this.#loadedScenes.length === 1 ? '' : 's'}`;
  }

  #renderInspector(): void {
    if (!this.#scene || !this.#svg) return;
    const rows = Object.values(this.#scene.catalog.objects).map((object) => {
      const button = document.createElement('button');
      button.className = 'edp-object';
      const type = document.createElement('span');
      type.textContent = object.type;
      const description = document.createElement('span');
      const key = document.createElement('b');
      key.textContent = object.key;
      const label = document.createElement('small');
      label.textContent = object.label;
      description.append(key, label);
      const id = document.createElement('code');
      id.textContent = `${object.primaryId.slice(0, 8)}…`;
      button.append(type, description, id);
      button.title = object.elementIds.join(', ');
      button.addEventListener('click', () => {
        setObjectVisible(this.#svg!, object, true);
        pulseObject(this.#svg!, object);
        focusObjects(this.#svg!, [object], { padding: 180 });
      });
      button.addEventListener('mouseenter', () => objectNodes(this.#svg!, object).forEach((node) => node.classList.add('edp-inspected')));
      button.addEventListener('mouseleave', () => objectNodes(this.#svg!, object).forEach((node) => node.classList.remove('edp-inspected')));
      return button;
    });
    this.#ref('objects').replaceChildren(...rows);
    this.#ref('objectCount').textContent = String(rows.length);
  }

  #updateUi(): void {
    if (!this.#scene || !this.#presentation) return;
    this.#shadow?.querySelectorAll<HTMLElement>('.edp-tree-scene').forEach((node) => {
      node.classList.toggle('edp-current-scene', Number(node.dataset.sceneIndex) === this.#sceneIndex);
    });
    this.#shadow?.querySelectorAll<HTMLElement>('.edp-scene-link').forEach((node) => {
      node.classList.toggle('edp-active', Number(node.dataset.sceneIndex) === this.#sceneIndex);
    });
    this.#shadow?.querySelectorAll<HTMLElement>('.edp-step').forEach((node) => {
      node.classList.toggle(
        'edp-active',
        Number(node.dataset.sceneIndex) === this.#sceneIndex && Number(node.dataset.stepIndex) === this.#stepIndex,
      );
    });
    this.#ref('sceneTitle').textContent = this.#scene.config.title ?? this.#presentation.scenes[this.#sceneIndex].title ?? `Scene ${this.#sceneIndex + 1}`;
    this.#ref('sceneCounter').textContent = `Scene ${this.#sceneIndex + 1} / ${this.#presentation.scenes.length}`;
    this.#ref('currentStep').textContent = this.#scene.config.timeline[this.#stepIndex]?.name ?? '';
    (this.#button('previous') as HTMLButtonElement).disabled = this.#sceneIndex === 0 && this.#stepIndex === 0;
    (this.#button('next') as HTMLButtonElement).disabled = this.#sceneIndex === this.#presentation.scenes.length - 1 && this.#stepIndex === this.#scene.config.timeline.length - 1;
  }

  #showStatus(message: string): void {
    if (!this.#shadow) return;
    this.#ref('error').hidden = true;
    const status = this.#ref('status');
    status.textContent = message;
    status.hidden = false;
  }

  #hideStatus(): void {
    this.#ref('status').hidden = true;
  }

  #showError(message: string): void {
    if (!this.#shadow) return;
    this.#hideStatus();
    const error = this.#ref('error');
    error.textContent = message;
    error.hidden = false;
  }

  #ref(name: string): HTMLElement {
    const element = this.#shadow?.querySelector<HTMLElement>(`[data-ref="${name}"]`);
    if (!element) throw new Error(`Missing internal player element: ${name}`);
    return element;
  }

  #button(action: string): HTMLButtonElement {
    const element = this.#shadow?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    if (!element) throw new Error(`Missing internal player action: ${action}`);
    return element;
  }
}

export function defineExcalidrawPlayer(tagName = 'excalidraw-player'): void {
  if (!globalThis.customElements) return;
  if (!customElements.get(tagName)) customElements.define(tagName, ExcalidrawPlayerElement);
}
