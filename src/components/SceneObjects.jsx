import '../domain/webkit-workers.js';
import React, { Suspense, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Billboard, Edges, Line, Text, useGLTF } from '@react-three/drei';

import { createCameraPoseSynchronizer } from '../domain/camera-snapshot.js';
import { DEVICE_CATALOG, getModelDefaultScale } from '../domain/catalog.js';
import { evaluateConnectionLength, getConnectionEndpoints, getConnectionRoute } from '../domain/connections.js';
import { toThreePosition, toThreeZRotation } from '../domain/coordinates.js';
import { applyGlbHighlight } from '../domain/glb-highlight.js';
import { getGenericModelAsset } from '../domain/model-assets.js';
import { getGenericModelLayout } from '../domain/generic-model-layouts.js';
import { modelAvailability } from '../domain/model-availability.js';

// The outlet plate is authored on three.js +Z, but wall snap aims local -Y
// (three.js -Z) into the room. Yaw the mesh so the plate meets the anchors.
const WALL_OUTLET_MESH_YAW = Math.PI;

for (const model of DEVICE_CATALOG.flatMap(category => category.models)) {
  if (model.assetUrl) useGLTF.preload(model.assetUrl);
}

// Same sans file Troika would download from jsDelivr. WebKit blocks that
// cross-origin font request, so the axis letters and power numbers are served
// from this site instead. The glyphs do not change.
const LABEL_FONT = `${import.meta.env.BASE_URL}fonts/axis-label.woff`;

const CABLE_COLORS = {
  power: '#e53935',
  hdmi: '#1e88e5',
  usb_c: '#43a047',
  ethernet: '#fb8c00',
  displayport: '#8e24aa',
  other: '#757575',
};

export function DeskLabAxes({ room }) {
  const size = Math.min(1.5, Math.min(room.length, room.width) * 0.25);
  const thickness = 0.015;
  const labelOffset = 0.2;

  return (
    <group position={[-room.length / 2, 0.02, -room.width / 2]}>
      <mesh position={[size / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[thickness, thickness, size, 8]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <Billboard position={[size + labelOffset, 0, 0]}>
        <Text font={LABEL_FONT} fontSize={0.3} color="red">X</Text>
      </Billboard>

      <mesh position={[0, 0, size / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[thickness, thickness, size, 8]} />
        <meshBasicMaterial color="green" />
      </mesh>
      <Billboard position={[0, 0, size + labelOffset]}>
        <Text font={LABEL_FONT} fontSize={0.3} color="green">Y</Text>
      </Billboard>

      <mesh position={[0, size / 2, 0]}>
        <cylinderGeometry args={[thickness, thickness, size, 8]} />
        <meshBasicMaterial color="blue" />
      </mesh>
      <Billboard position={[0, size + labelOffset, 0]}>
        <Text font={LABEL_FONT} fontSize={0.3} color="blue">Z</Text>
      </Billboard>
    </group>
  );
}

export function RoomWalls({ room }) {
  return (
    <group>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.length, room.width]} />
        <meshStandardMaterial color="#90a4ae" transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh position={[0, room.height / 2, 0]}>
        <boxGeometry args={[room.length, room.height, room.width]} />
        <meshStandardMaterial color="#cfd8dc" transparent opacity={0.04} depthWrite={false} side={2} />
        <Edges threshold={15} color="#546e7a" />
      </mesh>
    </group>
  );
}

// Lifts the drawn cable a little off the desktop it lies on, so the line is
// not hidden in the board's surface.
const CABLE_DRAW_LIFT = 0.006;

// A cable is drawn along its route (over the desk edge, not through the
// desktop). Only cables whose route or data changed redraw during a drag.
const CableLine = React.memo(function CableLine({ connection, points, dashed }) {
  return (
    <Line
      points={points.map(point => toThreePosition({ ...point, z: point.z + CABLE_DRAW_LIFT }))}
      color={CABLE_COLORS[connection.cableType] || CABLE_COLORS.other}
      lineWidth={3}
      dashed={dashed}
      dashSize={0.15}
      gapSize={0.1}
      raycast={() => null}
    />
  );
}, (previous, next) => previous.connection === next.connection
  && previous.dashed === next.dashed
  && previous.routeKey === next.routeKey);

export function ConnectionsRenderer({ connections, objects }) {
  const objectById = new Map(objects.map(object => [object.id, object]));
  return (
    <group>
      {connections.map(connection => {
        const fromObject = objectById.get(connection.fromObjectId);
        const toObject = objectById.get(connection.toObjectId);
        if (!fromObject || !toObject) return null;
        const endpoints = getConnectionEndpoints(connection, objects, objectById);
        const route = endpoints && getConnectionRoute(connection, objects, endpoints);
        if (!route) return null;
        const lengthStatus = evaluateConnectionLength(connection, objects, endpoints);
        return (
          <CableLine
            key={connection.id}
            connection={connection}
            points={route.points}
            routeKey={route.points.map(point => `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`).join(' ')}
            dashed={Boolean(lengthStatus && !lengthStatus.sufficient)}
          />
        );
      })}
    </group>
  );
}

export function CameraSetup({ cameraConfig, room, controlsRef, cameraRef }) {
  const { camera } = useThree();
  const poseSynchronizerRef = useRef(null);
  if (poseSynchronizerRef.current === null) {
    poseSynchronizerRef.current = createCameraPoseSynchronizer();
  }

  useEffect(() => {
    if (cameraRef) cameraRef.current = camera;
  }, [camera, cameraRef]);

  useEffect(() => {
    poseSynchronizerRef.current.sync({
      cameraConfig,
      room,
      camera,
      controls: controlsRef.current,
    });
  }, [cameraConfig, camera, controlsRef, room]);

  return null;
}

class GLTFErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('GLTF Load Error, falling back to box geometry.', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const PORT_MARKER_COLORS = {
  ac_input: '#ef5350',
  ac_output: '#ef5350',
  dc_input: '#ff7043',
  dc_output: '#ff7043',
  hdmi: '#1e88e5',
  displayport: '#8e24aa',
  usb_c: '#43a047',
  ethernet: '#fb8c00',
  other: '#757575',
};

function PortMarkers({ obj }) {
  const markerRadius = Math.min(
    0.04,
    Math.max(0.012, Math.min(obj.scale.x, obj.scale.y, obj.scale.z) * 0.12)
  );
  return (
    <group>
      {(obj.ports || []).map(port => {
        const anchor = port.anchor;
        if (!anchor || !['x', 'y', 'z'].every(axis => Number.isFinite(anchor[axis]))) return null;
        const color = PORT_MARKER_COLORS[port.type] || PORT_MARKER_COLORS.other;
        return (
          <mesh
            key={port.id}
            position={[
              anchor.x * obj.scale.x,
              anchor.z * obj.scale.z,
              anchor.y * obj.scale.y,
            ]}
            raycast={() => null}
          >
            <sphereGeometry args={[markerRadius, 12, 8]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.35}
              depthTest={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function cloneSceneWithHighlight(scene, highlight) {
  const clone = scene.clone();
  clone.traverse(child => {
    if (!child.isMesh || !child.material) return;
    const source = Array.isArray(child.material) ? child.material : [child.material];
    const cloned = source.map(material => applyGlbHighlight(material.clone(), highlight));
    child.material = Array.isArray(child.material) ? cloned : cloned[0];
  });
  return clone;
}

// 'none' without a URL; otherwise 'pending' until the file check settles.
function useModelAvailability(url) {
  const [state, setState] = React.useState(() => (url ? modelAvailability.peek(url) : 'none'));
  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    modelAvailability.check(url).then(available => {
      if (active) setState(available ? 'available' : 'missing');
    });
    return () => { active = false; };
  }, [url]);
  return url ? state : 'none';
}

function GLBModel({ url, scaleRatio, meshYaw = 0, isSelected, isRelated, isHovered }) {
  const { scene } = useGLTF(url);
  const clonedScene = React.useMemo(
    () => cloneSceneWithHighlight(scene, { isSelected, isRelated, isHovered }),
    [scene, isSelected, isRelated, isHovered]
  );

  return (
    <primitive
      object={clonedScene}
      scale={[scaleRatio.x, scaleRatio.z, scaleRatio.y]}
      rotation={[0, meshYaw, 0]}
    />
  );
}

function getHighlightMaterialProps({ isSelected, isRelated, isHovered }) {
  if (isSelected) return { emissiveColor: 'white', emissiveIntensity: 0.3 };
  if (isRelated) return { emissiveColor: '#ffeb3b', emissiveIntensity: 0.4 };
  if (isHovered) return { emissiveColor: '#81c784', emissiveIntensity: 0.2 };
  return { emissiveColor: 'black', emissiveIntensity: 0 };
}

function FallbackBox({ obj, materialProps }) {
  return (
    <mesh>
      <boxGeometry args={[obj.scale.x, obj.scale.z, obj.scale.y]} />
      <meshStandardMaterial
        color={obj.color}
        emissive={materialProps.emissiveColor}
        emissiveIntensity={materialProps.emissiveIntensity}
      />
    </mesh>
  );
}

function GenericMonitorModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const panelHeight = height * 0.68;
  const standHeight = height * 0.26;
  const layout = getGenericModelLayout(obj.modelId);
  const [panel] = layout.panels;
  const [screen] = layout.screens;
  const [rearHousing] = layout.rearHousings;
  const [stand] = layout.stands;
  const [base] = layout.bases;

  return (
    <group>
      <mesh position={[panel.x * width, height * 0.12, panel.z * depth]}>
        <boxGeometry args={[panel.width * width, panelHeight, panel.depth * depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[screen.x * width, height * 0.12, screen.z * depth]}>
        <boxGeometry args={[screen.width * width, panelHeight * 0.72, screen.depth * depth]} />
        <meshStandardMaterial color="#111827" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[rearHousing.x * width, height * 0.12, rearHousing.z * depth]}>
        <boxGeometry args={[rearHousing.width * width, panelHeight * 0.42, rearHousing.depth * depth]} />
        <meshStandardMaterial color="#2f3a45" roughness={0.75} />
      </mesh>
      <mesh position={[stand.x * width, -height * 0.25, stand.z * depth]}>
        <boxGeometry args={[stand.width * width, standHeight, stand.depth * depth]} />
        <meshStandardMaterial
          color="#3b4652"
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity * 0.5}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[base.x * width, -height * 0.43, base.z * depth]}>
        <boxGeometry args={[base.width * width, height * 0.07, base.depth * depth]} />
        <meshStandardMaterial color="#202832" roughness={0.7} />
      </mesh>
    </group>
  );
}

function GenericPowerStripModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const socketRadius = Math.min(depth * 0.14, width * 0.025);
  const layout = getGenericModelLayout(obj.modelId);
  const [body] = layout.bodies;
  const [topPlate] = layout.topPlates;
  const [inputEnd] = layout.inputEnds;

  return (
    <group>
      <mesh position={[width * body.x, 0, depth * body.z]}>
        <boxGeometry args={[width * body.width, height, depth * body.depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[width * topPlate.x, height * 0.51, depth * topPlate.z]}>
        <boxGeometry args={[width * topPlate.width, height * 0.06, depth * topPlate.depth]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      {layout.socketPairs.map((socketPair, index) => (
          <group key={index} position={[width * socketPair.x, height * 0.56, depth * socketPair.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh position={[-socketRadius * 0.8, 0, 0]}>
              <cylinderGeometry args={[socketRadius, socketRadius, height * 0.035, 12]} />
              <meshStandardMaterial color="#202124" roughness={0.7} />
            </mesh>
            <mesh position={[socketRadius * 0.8, 0, 0]}>
              <cylinderGeometry args={[socketRadius, socketRadius, height * 0.035, 12]} />
              <meshStandardMaterial color="#202124" roughness={0.7} />
            </mesh>
          </group>
      ))}
      <mesh position={[width * inputEnd.x, height * 0.08, depth * inputEnd.z]}>
        <boxGeometry args={[width * inputEnd.width, height * 0.35, depth * inputEnd.depth]} />
        <meshStandardMaterial color="#2f3a45" roughness={0.8} />
      </mesh>
    </group>
  );
}

function GenericRouterModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const antennaHeight = height * 0.85;
  const layout = getGenericModelLayout(obj.modelId);
  const [body] = layout.bodies;

  return (
    <group>
      <mesh position={[width * body.x, 0, depth * body.z]}>
        <boxGeometry args={[width * body.width, height, depth * body.depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.58}
        />
      </mesh>
      {layout.ports.map((port, index) => (
          <mesh key={index} position={[width * port.x, height * 0.1, depth * port.z]}>
            <boxGeometry args={[width * port.width, height * 0.36, depth * port.depth]} />
            <meshStandardMaterial color="#102027" roughness={0.65} />
          </mesh>
      ))}
      <mesh position={[width * layout.antennas[1].x, height * 0.52, depth * layout.antennas[1].z]} rotation={[0, 0, layout.antennas[1].rotation]}>
        <cylinderGeometry args={[width * 0.012, width * 0.012, antennaHeight, 8]} />
        <meshStandardMaterial color="#263238" roughness={0.7} />
      </mesh>
      <mesh position={[width * layout.antennas[0].x, height * 0.52, depth * layout.antennas[0].z]} rotation={[0, 0, layout.antennas[0].rotation]}>
        <cylinderGeometry args={[width * 0.012, width * 0.012, antennaHeight, 8]} />
        <meshStandardMaterial color="#263238" roughness={0.7} />
      </mesh>
      <mesh position={[width * layout.statusLights[0].x, height * 0.52, depth * layout.statusLights[0].z]}>
        <sphereGeometry args={[Math.min(width, depth) * 0.035, 12, 8]} />
        <meshStandardMaterial color="#76ff03" emissive="#76ff03" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function GenericDesktopPcModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const layout = getGenericModelLayout(obj.modelId);
  const [body] = layout.bodies;
  const [frontPanel] = layout.frontPanels;
  const [fanVent] = layout.fanVents;
  const [powerButton] = layout.powerButtons;
  const [statusLight] = layout.statusLights;
  const frontPorts = layout.frontPorts;
  const fanVentRadius = Math.min(width, height) * fanVent.width / 2;

  return (
    <group>
      <mesh position={[width * body.x, 0, depth * body.z]}>
        <boxGeometry args={[width * body.width, height, depth * body.depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[width * frontPanel.x, 0, depth * frontPanel.z]}>
        <boxGeometry args={[width * frontPanel.width, height * 0.88, depth * frontPanel.depth]} />
        <meshStandardMaterial color="#20252b" roughness={0.7} />
      </mesh>
      <mesh position={[width * fanVent.x, height * 0.27, depth * fanVent.z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[fanVentRadius, fanVentRadius, depth * fanVent.depth, 20]} />
        <meshStandardMaterial color="#111827" roughness={0.78} />
      </mesh>
      <mesh position={[width * powerButton.x, -height * 0.27, depth * powerButton.z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[width * powerButton.width / 2, width * powerButton.width / 2, depth * powerButton.depth, 20]} />
        <meshStandardMaterial color="#0f172a" roughness={0.55} />
      </mesh>
      <mesh
        position={[width * statusLight.x, -height * 0.27, depth * statusLight.z]}
        scale={[width * statusLight.width / 2, width * statusLight.width / 2, depth * statusLight.depth / 2]}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.45} />
      </mesh>
      {frontPorts.map((port, index) => (
        <mesh key={index} position={[width * port.x, height * (-0.27 + index * 0.09), depth * port.z]}>
          <boxGeometry args={[width * port.width, height * 0.045, depth * port.depth]} />
          <meshStandardMaterial color="#0f172a" roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function GenericPowerAdapterModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const layout = getGenericModelLayout(obj.modelId);
  const [body] = layout.bodies;
  const [label] = layout.labels;
  const acPins = layout.acPins;
  const [dcStrainRelief] = layout.dcStrainReliefs;

  return (
    <group>
      <mesh position={[width * body.x, 0, depth * body.z]}>
        <boxGeometry args={[width * body.width, height, depth * body.depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[width * label.x, height * 0.52, depth * label.z]}>
        <boxGeometry args={[width * label.width, height * 0.04, depth * label.depth]} />
        <meshStandardMaterial color="#475569" roughness={0.72} />
      </mesh>
      {acPins.map((pin, index) => (
        <mesh key={index} position={[width * pin.x, 0, depth * pin.z]}>
          <boxGeometry args={[width * pin.width, height * 0.36, depth * pin.depth]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.65} roughness={0.32} />
        </mesh>
      ))}
      <mesh
        position={[width * dcStrainRelief.x, 0, depth * dcStrainRelief.z]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[width * dcStrainRelief.width / 2, depth * dcStrainRelief.depth, height * 0.23]}
      >
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial color="#111827" roughness={0.76} />
      </mesh>
    </group>
  );
}

function GenericWallOutletModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const slotHeight = height * 0.16;
  const layout = getGenericModelLayout(obj.modelId);
  const [body] = layout.bodies;
  const [faceplate] = layout.faceplates;
  const slots = layout.slots;
  const [fastener] = layout.fasteners;

  return (
    <group rotation={[0, WALL_OUTLET_MESH_YAW, 0]}>
      <mesh position={[width * body.x, 0, depth * body.z]}>
        <boxGeometry args={[width * body.width, height, depth * body.depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[width * faceplate.x, 0, depth * faceplate.z]}>
        <boxGeometry args={[width * faceplate.width, height * 0.88, depth * faceplate.depth]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.48} />
      </mesh>
      {slots.map((slot, index) => (
        <mesh
          key={index}
          position={[width * slot.x, height * (index < 2 ? -0.22 : 0.22), depth * slot.z]}
        >
          <boxGeometry args={[width * slot.width, slotHeight, depth * slot.depth]} />
          <meshStandardMaterial color="#1f2937" roughness={0.72} />
        </mesh>
      ))}
      <mesh
        position={[width * fastener.x, 0, depth * fastener.z]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[width * fastener.width / 2, depth * fastener.depth, width * 0.035]}
      >
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.45} roughness={0.38} />
      </mesh>
    </group>
  );
}

function GenericLaptopModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const layout = getGenericModelLayout(obj.modelId);
  const [base] = layout.bases;
  const [keyboard] = layout.keyboards;
  const [lid] = layout.lids;
  const [screen] = layout.screens;
  const [hinge] = layout.hinges;

  return (
    <group>
      <mesh position={[width * base.x, -height * 0.42, depth * base.z]}>
        <boxGeometry args={[width * base.width, height * 0.12, depth * base.depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[width * keyboard.x, -height * 0.35, depth * keyboard.z]}>
        <boxGeometry args={[width * keyboard.width, height * 0.025, depth * keyboard.depth]} />
        <meshStandardMaterial color="#1f2937" roughness={0.68} />
      </mesh>
      <mesh position={[width * lid.x, height * 0.02, depth * lid.z]}>
        <boxGeometry args={[width * lid.width, height * 0.78, depth * lid.depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.58}
        />
      </mesh>
      <mesh position={[width * screen.x, height * 0.02, depth * screen.z]}>
        <boxGeometry args={[width * screen.width, height * 0.62, depth * screen.depth]} />
        <meshStandardMaterial color="#0f172a" roughness={0.34} metalness={0.12} />
      </mesh>
      <mesh position={[width * hinge.x, -height * 0.36, depth * hinge.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[height * 0.045, height * 0.045, width * hinge.width, 12]} />
        <meshStandardMaterial color="#334155" roughness={0.64} />
      </mesh>
    </group>
  );
}

function GenericOfficeDeskModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const footprintBase = Math.min(width, depth);
  const layout = getGenericModelLayout('office-desk');
  const [desktop] = layout.tops;
  const [cableTray] = layout.cableTrays;

  return (
    <group>
      <mesh position={[desktop.x * width, height * 0.44, desktop.z * depth]}>
        <boxGeometry args={[desktop.width * width, height * 0.12, desktop.depth * depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.58}
        />
      </mesh>
      {layout.legs.map(leg => (
        <mesh key={`${leg.x}-${leg.z}`} position={[leg.x * width, -height * 0.03, leg.z * depth]}>
          <boxGeometry args={[leg.width * footprintBase, height * 0.82, leg.depth * footprintBase]} />
          <meshStandardMaterial color="#475569" metalness={0.18} roughness={0.62} />
        </mesh>
      ))}
      <mesh position={[cableTray.x * width, height * 0.31, cableTray.z * depth]}>
        <boxGeometry args={[cableTray.width * width, height * 0.1, cableTray.depth * depth]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>
    </group>
  );
}

function GenericModel({ asset, obj, materialProps }) {
  if (asset?.id === 'generic-monitor') {
    return <GenericMonitorModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-power-strip') {
    return <GenericPowerStripModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-router') {
    return <GenericRouterModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-desktop-pc') {
    return <GenericDesktopPcModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-power-adapter') {
    return <GenericPowerAdapterModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-wall-outlet') {
    return <GenericWallOutletModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-laptop') {
    return <GenericLaptopModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-office-desk') {
    return <GenericOfficeDeskModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-keyboard' || asset?.id === 'generic-mouse' || asset?.id === 'generic-desk-lamp' || asset?.id === 'generic-speakers') {
    return <GenericBlockModel obj={obj} materialProps={materialProps} />;
  }
  return <FallbackBox obj={obj} materialProps={materialProps} />;
}

function GenericBlockModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const layout = getGenericModelLayout(obj.modelId);
  return (
    <group>
      {(layout?.bodies || []).map((body, index) => (
        <mesh key={index} position={[width * body.x, 0, depth * body.z]}>
          <boxGeometry args={[width * body.width, height, depth * body.depth]} />
          <meshStandardMaterial
            color={obj.color}
            emissive={materialProps.emissiveColor}
            emissiveIntensity={materialProps.emissiveIntensity}
            roughness={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}

export const DeviceMesh = React.memo(function DeviceMesh({
  obj,
  isSelected,
  isRelated,
  isHovered,
  handlersRef,
}) {
  const defaultScale = obj.modelId ? getModelDefaultScale(obj.category, obj.modelId) : null;
  const scaleRatio = defaultScale ? {
    x: obj.scale.x / defaultScale.x,
    y: obj.scale.y / defaultScale.y,
    z: obj.scale.z / defaultScale.z,
  } : { x: 1, y: 1, z: 1 };
  const materialProps = getHighlightMaterialProps({ isSelected, isRelated, isHovered });
  const genericAsset = getGenericModelAsset(obj.modelId);
  const modelState = useModelAvailability(obj.assetUrl);
  const renderFallback = () => (genericAsset
    ? <GenericModel asset={genericAsset} obj={obj} materialProps={materialProps} />
    : <FallbackBox obj={obj} materialProps={materialProps} />);

  return (
    <group
      position={toThreePosition(obj.position)}
      rotation={toThreeZRotation(obj.rotation?.z)}
      onClick={(event) => {
        event.stopPropagation();
        handlersRef.current.onObjectClick(obj);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        handlersRef.current.onObjectPointerDown(obj, event.point);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        handlersRef.current.onObjectHover(obj);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        handlersRef.current.onObjectHoverEnd(obj);
      }}
    >
      {modelState === 'available' ? (
        <GLTFErrorBoundary fallback={renderFallback()}>
          <Suspense fallback={renderFallback()}>
            <GLBModel
              url={obj.assetUrl}
              scaleRatio={scaleRatio}
              meshYaw={obj.modelId === 'wall-outlet' ? WALL_OUTLET_MESH_YAW : 0}
              isSelected={isSelected}
              isRelated={isRelated}
              isHovered={isHovered}
            />
          </Suspense>
        </GLTFErrorBoundary>
      ) : renderFallback()}
      {isSelected ? <PortMarkers obj={obj} /> : null}
    </group>
  );
});

