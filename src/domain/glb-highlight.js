/**
 * Selection highlight for a cloned glTF material.
 * An idle material keeps the emissive colour and strength authored in the
 * file (status LEDs, the PC fan ring). Selected, related, and hovered states
 * replace emissive, matching the generic meshes.
 */
export function applyGlbHighlight(material, { isSelected = false, isRelated = false, isHovered = false } = {}) {
  if (!material?.emissive || typeof material.emissive.setHex !== 'function') return material;
  if (isSelected) {
    material.emissive.setHex(0xffffff);
    material.emissiveIntensity = 0.3;
  } else if (isRelated) {
    material.emissive.setHex(0xffeb3b);
    material.emissiveIntensity = 0.4;
  } else if (isHovered) {
    material.emissive.setHex(0x81c784);
    material.emissiveIntensity = 0.2;
  }
  return material;
}

// One clone per on-screen device. Hovering used to clone the whole glTF
// scene (and every material) again; the authored emissive is remembered so
// clearing the highlight puts the LEDs back.
export function cloneModelForHighlight(scene) {
  const clone = scene.clone();
  clone.traverse(child => {
    if (!child.isMesh || !child.material) return;
    const source = Array.isArray(child.material) ? child.material : [child.material];
    const cloned = source.map(material => material.clone());
    child.material = Array.isArray(child.material) ? cloned : cloned[0];
  });
  return clone;
}

export function applySceneHighlight(root, { isSelected = false, isRelated = false, isHovered = false } = {}) {
  root.traverse(child => {
    if (!child.isMesh || !child.material) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of list) {
      if (!material?.emissive || typeof material.emissive.clone !== 'function') continue;
      if (!material.userData.desklabEmissive) {
        material.userData.desklabEmissive = {
          color: material.emissive.clone(),
          intensity: material.emissiveIntensity,
        };
      }
      const idle = !isSelected && !isRelated && !isHovered;
      if (idle) {
        material.emissive.copy(material.userData.desklabEmissive.color);
        material.emissiveIntensity = material.userData.desklabEmissive.intensity;
      } else {
        applyGlbHighlight(material, { isSelected, isRelated, isHovered });
      }
    }
  });
}
