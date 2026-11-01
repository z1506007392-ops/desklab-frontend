import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';

import {
  GIZMO_ROTATION_SNAP_RADIANS,
  deskPositionToThree,
  deskRotationToThreeY,
  gizmoAxisVisibility,
  gizmoHandleColor,
  threePositionToDesk,
  threeYToDeskRotation,
} from '../domain/gizmo-pose.js';

const HIDDEN_HANDLES = new Set(['XY', 'YZ', 'XZ', 'XYZ', 'XYZE', 'E']);

function writePose(group, object) {
  const position = deskPositionToThree(object.position);
  group.position.set(position.x, position.y, position.z);
  group.rotation.set(0, deskRotationToThreeY(object.rotation?.z), 0);
  group.updateMatrixWorld();
}

function paintHandleColors(root) {
  if (!root) return;
  root.traverse(child => {
    const color = gizmoHandleColor(child.name);
    if (!color || !child.material?.color) return;
    const material = child.material.clone();
    material.color.set(color);
    material.tempColor = material.color.clone();
    child.material = material;
  });
}

// Plane squares and the center grab are hidden so the handles stay three
// arrows (and one vertical ring), the same idea as the corner axes.
function hideCombinedHandles(gizmoRoot) {
  if (!gizmoRoot) return;
  for (const collection of [gizmoRoot.gizmo, gizmoRoot.picker]) {
    if (!collection) continue;
    for (const mode of ['translate', 'rotate']) {
      collection[mode]?.traverse(child => {
        if (!HIDDEN_HANDLES.has(child.name)) return;
        child.visible = false;
        // updateMatrixWorld turns visibility back on; an empty raycast keeps
        // the plane squares from stealing a drag off the device body.
        child.raycast = () => {};
      });
    }
  }
}

// Move / rotate handles for the selected device. The handles drag an empty
// group; the device mesh itself stays driven by React state, through the same
// update the pointer drag uses.
export default function SelectionGizmo({
  object,
  mode,
  size,
  enabled,
  onChange,
  onDragStart,
  onDragEnd,
}) {
  const group = useRef(null);
  const controlsRef = useRef(null);
  // The handles are painted on the controls instance actually drawn. Under
  // React's StrictMode double mount, a ref read once at mount can be a copy
  // that never reaches the scene, so the instance arrives through a callback
  // ref and is painted whenever it changes.
  const [controlsVersion, setControlsVersion] = useState(0);
  const attachControls = useCallback(instance => {
    if (controlsRef.current === instance) return;
    controlsRef.current = instance;
    setControlsVersion(version => version + 1);
  }, []);
  const dragging = useRef(false);
  const objectRef = useRef(object);
  const onChangeRef = useRef(onChange);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const gl = useThree(state => state.gl);

  useLayoutEffect(() => {
    objectRef.current = object;
    onChangeRef.current = onChange;
    onDragStartRef.current = onDragStart;
    onDragEndRef.current = onDragEnd;
  });

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls?.updateMatrixWorld) return undefined;
    paintHandleColors(controls.gizmo?.gizmo?.translate);
    paintHandleColors(controls.gizmo?.gizmo?.rotate);
    const original = controls.updateMatrixWorld;
    controls.updateMatrixWorld = () => {
      original();
      hideCombinedHandles(controls.gizmo);
    };
    return () => {
      controls.updateMatrixWorld = original;
    };
  }, [controlsVersion]);

  useLayoutEffect(() => {
    if (!group.current || dragging.current) return;
    writePose(group.current, object);
  }, [object]);

  // Fiber hears the click before TransformControls and would treat a handle
  // as empty canvas (deselect) or as the device (start a plane drag).
  // Claiming the pointer in the capture phase keeps the handle on this path.
  useEffect(() => {
    const dom = gl.domElement;
    let claimClick = false;
    const onDown = (event) => {
      const controls = controlsRef.current;
      if (!controls?.enabled || event.button !== 0) return;
      controls.pointerHover(controls.getPointer(event));
      if (controls.axis == null) {
        claimClick = false;
        return;
      }
      event.stopPropagation();
      claimClick = true;
      controls.onPointerDown(event);
    };
    const onClick = (event) => {
      if (!claimClick) return;
      event.stopPropagation();
      claimClick = false;
    };
    dom.addEventListener('pointerdown', onDown, true);
    dom.addEventListener('click', onClick, true);
    return () => {
      dom.removeEventListener('pointerdown', onDown, true);
      dom.removeEventListener('click', onClick, true);
    };
  }, [gl]);

  const axes = gizmoAxisVisibility(mode);

  return (
    <>
      <group ref={group} />
      <TransformControls
        ref={attachControls}
        object={group}
        enabled={enabled}
        mode={mode === 'rotate' ? 'rotate' : 'translate'}
        space="world"
        size={size}
        rotationSnap={GIZMO_ROTATION_SNAP_RADIANS}
        showX={axes.showX}
        showY={axes.showY}
        showZ={axes.showZ}
        onMouseDown={() => {
          dragging.current = true;
          onDragStartRef.current?.();
        }}
        onObjectChange={() => {
          const current = group.current;
          if (!current) return;
          const update = {
            position: threePositionToDesk(current.position),
            rotationZ: threeYToDeskRotation(current.rotation.y),
          };
          const applied = onChangeRef.current?.(update);
          writePose(current, applied || objectRef.current);
        }}
        onMouseUp={() => {
          dragging.current = false;
          onDragEndRef.current?.();
          if (group.current && objectRef.current) writePose(group.current, objectRef.current);
        }}
      />
    </>
  );
}
