import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { applySceneHighlight, cloneModelForHighlight } from '../src/domain/glb-highlight.js';

function authoredScene() {
  const scene = new Group();
  const material = new MeshStandardMaterial({ color: 0x223344, emissive: 0x112233, emissiveIntensity: 0.55 });
  scene.add(new Mesh(new BoxGeometry(1, 1, 1), material));
  return scene;
}

test('highlight replaces emissive and clearing it restores the authored LED', () => {
  const clone = cloneModelForHighlight(authoredScene());
  const material = clone.children[0].material;
  assert.equal(material.emissive.getHex(), 0x112233);
  applySceneHighlight(clone, { isSelected: true });
  assert.equal(material.emissive.getHex(), 0xffffff);
  assert.equal(material.emissiveIntensity, 0.3);
  applySceneHighlight(clone, { isHovered: true });
  assert.equal(material.emissive.getHex(), 0x81c784);
  assert.equal(material.emissiveIntensity, 0.2);
  applySceneHighlight(clone, {});
  assert.equal(material.emissive.getHex(), 0x112233);
  assert.equal(material.emissiveIntensity, 0.55);
});

test('a second highlight reuses the cloned material instead of cloning again', () => {
  const clone = cloneModelForHighlight(authoredScene());
  const material = clone.children[0].material;
  applySceneHighlight(clone, { isRelated: true });
  applySceneHighlight(clone, { isSelected: true });
  assert.equal(clone.children[0].material, material);
  assert.equal(material.emissive.getHex(), 0xffffff);
});
