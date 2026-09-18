import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import test from 'node:test';
import {
  loadPresentation,
  loadScene,
  parseExcalidraw,
  parseStructuredDocument,
  resolveCatalog,
  SceneConfigError,
  validateTimeline,
} from '../dist/core.js';

const fixtures = new URL('./fixtures/', import.meta.url);
const readFixture = (name) => readFile(new URL(name, fixtures), 'utf8');

async function scene(name) {
  const [drawingSource, configSource] = await Promise.all([
    readFixture(`${name}.excalidraw`),
    readFixture(`${name}.yaml`),
  ]);
  const drawing = parseExcalidraw(drawingSource);
  const config = parseStructuredDocument(configSource);
  return { drawing, config };
}

test('parses compressed Obsidian Excalidraw markdown', async () => {
  const drawing = parseExcalidraw(await readFixture('scene-one.excalidraw.md'));
  assert.equal(drawing.elements.length, 7);
  assert.equal(drawing.elements.find((element) => element.id === 'client-text')?.text, 'Client');
});

test('parses regular Excalidraw JSON and resolves semantic bundles', async () => {
  const { drawing, config } = await scene('scene-one');
  const catalog = resolveCatalog(drawing, config);
  assert.equal(drawing.elements.length, 7);
  assert.equal(Object.keys(catalog.objects).length, 4);
  assert.deepEqual(catalog.objects.client.elementIds, ['client-box', 'client-text']);
  assert.equal(catalog.objects.request.primaryId, 'request-arrow');
  assert.deepEqual(catalog.unclaimed, []);
  assert.equal(validateTimeline(config, catalog), true);
});

test('uses endpoints to disambiguate duplicate arrow labels', async () => {
  const { drawing, config } = await scene('scene-two');
  const catalog = resolveCatalog(drawing, config);
  assert.equal(catalog.objects['client-request'].primaryId, 'request-one-arrow');
  assert.equal(catalog.objects['service-request'].primaryId, 'request-two-arrow');

  assert.throws(
    () => resolveCatalog(drawing, { ...config, objects: { request: { arrow: { label: 'Request' } } } }),
    (error) => error instanceof SceneConfigError && /matched 2 elements/.test(error.message),
  );
});

test('validates timeline references', async () => {
  const { drawing, config } = await scene('scene-one');
  const catalog = resolveCatalog(drawing, config);
  assert.throws(
    () => validateTimeline({ ...config, timeline: [{ show: ['missing'] }] }, catalog),
    (error) => error instanceof SceneConfigError && /unknown object/.test(error.message),
  );
});

test('loads a two-scene presentation through an injected fetcher', async () => {
  const fetchFixture = async (url) => readFixture(basename(new URL(url).pathname));
  const presentation = await loadPresentation('https://example.test/presentation.yaml', fetchFixture);
  assert.equal(presentation.scenes.length, 2);
  assert.equal(presentation.scenes[1].resolvedConfigUrl, 'https://example.test/scene-two.yaml');

  const second = await loadScene(presentation.scenes[1], fetchFixture);
  assert.equal(second.config.title, 'Gateway introduced');
  assert.equal(Object.keys(second.catalog.objects).length, 6);
});
