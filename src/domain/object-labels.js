// Names for devices in pickers. The user's own name is enough on its own;
// when several devices share a name (two "27 英寸显示器"), number them so
// the choice is not ambiguous. Internal type ids are never shown.
export function labelObjectsForPicker(objects) {
  const totals = new Map();
  for (const object of objects) totals.set(object.name, (totals.get(object.name) ?? 0) + 1);
  const seen = new Map();
  const labels = new Map();
  for (const object of objects) {
    const name = object.name || '未命名设备';
    if (totals.get(object.name) > 1) {
      const index = (seen.get(object.name) ?? 0) + 1;
      seen.set(object.name, index);
      labels.set(object.id, `${name}（第 ${index} 台）`);
    } else {
      labels.set(object.id, name);
    }
  }
  return labels;
}
