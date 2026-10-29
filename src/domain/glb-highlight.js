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
