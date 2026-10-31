// Wheel and pinch zoom the room. Selecting a device must not steal that
// gesture to resize it; size stays in the property panel. A read-only share
// can still orbit and zoom.
export function cameraZoomEnabled({ editable, viewOnly, connectionMode, dragging, gizmoDragging }) {
  return (Boolean(editable) || Boolean(viewOnly)) && !connectionMode && !dragging && !gizmoDragging;
}
