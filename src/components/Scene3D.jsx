import { useState } from 'react';
import { WebGLRenderer } from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';

import { toThreePosition } from '../domain/coordinates.js';
import { createRendererOrReport } from '../domain/webgl-support.js';
import {
  CameraSetup,
  ConnectionsRenderer,
  DeskLabAxes,
  DeviceMesh,
  PowerStatusOverlay,
  RoomWalls,
} from './SceneObjects.jsx';

// The 3D view and everything that pulls in three.js. App loads it lazily so
// the toolbar and panels appear before the large 3D libraries arrive; all
// state and decisions stay in App and come in as props and callbacks.
export default function Scene3D({
  reportFailure,
  cameraConfig,
  room,
  controlsRef,
  cameraRef,
  controlsEnabled,
  zoomEnabled,
  onCameraInteractionEnd,
  dragPlaneY,
  onDragMove,
  onDragEnd,
  showAxes,
  objects,
  connections,
  selectedObjectId,
  relatedIds,
  hoveredObjectId,
  onBackgroundClick,
  onObjectClick,
  onObjectPointerDown,
  onObjectHover,
  onObjectHoverEnd,
}) {
  // drei's Html comes up empty when it mounts with the Canvas (fiber 9 /
  // React 19), so the selection tag is portalled into a plain layer laid
  // over the canvas instead (threejs-react-three-fiber skill).
  const [overlay, setOverlay] = useState(null);
  const selected = objects.find(obj => obj.id === selectedObjectId);

  return (
    <>
    <Canvas
      gl={defaults => createRendererOrReport(props => new WebGLRenderer(props), defaults, reportFailure)}
      onPointerMissed={onBackgroundClick}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <CameraSetup cameraConfig={cameraConfig} room={room} controlsRef={controlsRef} cameraRef={cameraRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={controlsEnabled}
        enableZoom={zoomEnabled}
        onEnd={onCameraInteractionEnd}
      />

      {dragPlaneY !== null && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]} position={[0, dragPlaneY, 0]}
          onPointerMove={(e) => {
            e.stopPropagation();
            onDragMove(e.point);
          }}
          onPointerUp={(e) => { e.stopPropagation(); onDragEnd(); }}
        >
          <planeGeometry args={[2000, 2000]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}

      {showAxes && <DeskLabAxes room={room} />}
      <Grid infiniteGrid fadeDistance={40} sectionColor="#cfd8dc" cellColor="#eceff1" />

      {/* 实体墙壁与线框 */}
      <RoomWalls room={room} />

      {/* 连接线渲染 */}
      <ConnectionsRenderer connections={connections} objects={objects} />

      {/* 电力状态浮标 */}
      <PowerStatusOverlay objects={objects} connections={connections} />

      {objects.map(obj => (
        <DeviceMesh
          key={obj.id}
          obj={obj}
          isSelected={selectedObjectId === obj.id}
          isRelated={relatedIds.has(obj.id)}
          isHovered={hoveredObjectId === obj.id && obj.id !== selectedObjectId}
          onClick={(e) => {
            e.stopPropagation();
            onObjectClick(obj);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onObjectPointerDown(obj, e.point);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            onObjectHover(obj);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onObjectHoverEnd(obj);
          }}
        />
      ))}

      {selected && overlay && <SelectionTag obj={selected} overlay={overlay} />}
    </Canvas>
    <div ref={setOverlay} className="scene-overlay" />
    </>
  );
}

// The 桌搭 tag pinned above the selected device, the way a desk-setup post
// tags items on the photo. The selection hint under the toolbar already
// announces the selection, so this copy is hidden from screen readers.
function SelectionTag({ obj, overlay }) {
  const top = toThreePosition({ ...obj.position, z: obj.position.z + obj.scale.z / 2 + 0.03 });
  return (
    <Html position={top} portal={{ current: overlay }} zIndexRange={[2, 1]} pointerEvents="none">
      <div className="scene-tag" key={obj.id} aria-hidden="true">{obj.name}</div>
    </Html>
  );
}
