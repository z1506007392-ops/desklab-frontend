// Wheel and pinch zoom the room. Selecting a device must not steal that
// gesture to resize it; size stays in the property panel.
export function cameraZoomEnabled({ editable, connectionMode, dragging, gizmoDragging }) {
  return Boolean(editable) && !connectionMode && !dragging && !gizmoDragging;
}
