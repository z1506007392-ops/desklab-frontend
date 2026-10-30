import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { evaluateConnectionLength } from './domain/connections.js';
import { createLocalProjectClient } from './domain/local-project-store.js';
import {
  analyzeProjectWiring,
  getInvalidConnectionIds,
  summarizeWiringIssues,
} from './domain/analysis.js';
import { constrainProjectToRoom, safeClamp, validateAndConstrainObject } from './domain/geometry.js';
import {
  analyzeProjectLayout,
  snapObjectToSupport,
  snapWallOutletToNearestWall,
  summarizeLayoutIssues,
} from './domain/layout-analysis.js';
import {
  createProjectDraft,
  isDraftDifferent,
} from './domain/draft.js';
import { createProjectDraftStorage } from './domain/draft-storage.js';
import './App.css';
import {
  DEVICE_CATALOG,
  describeCatalogModel,
  findModelTemplate,
  hydrateProjectObjects,
} from './domain/catalog.js';
import { captureCameraSnapshot } from './domain/camera-snapshot.js';
import { placeCatalogObject } from './domain/placement.js';
import { createEntityId } from './domain/identifiers.js';
import { getObjectKeyboardUpdate } from './domain/keyboard-controls.js';
import {
  canEditProject,
  canStartObjectDrag,
  getCanvasObjectClickAction,
} from './domain/project-access.js';
import { createProjectExport } from './domain/project-export.js';
import { describeSelectionHint } from './domain/selection-hint.js';
import {
  readBackupReminderState,
  recordBackupExport,
  shouldRemindBackup,
  snoozeBackupReminder,
} from './domain/backup-reminder.js';
import {
  assertProjectImportSize,
  describeProjectImportError,
  getProjectImportByteLength,
} from './domain/project-import-limits.js';
import { getPurchaseGuidance } from './domain/purchase-guidance.js';
import { DESK_TEMPLATES, buildTemplateScene } from './domain/desk-templates.js';
import { buildShoppingList } from './domain/shopping-list.js';
import { applyAllAvailableImprovements, applyAllImprovements, applyImprovement, buildConnectionCompletion, buildFreeImprovements, buildRecommendations } from './domain/recommendations.js';
import { createProjectHistory } from './domain/project-history.js';
import { createStatusNotifier } from './domain/status-notifier.js';
import PropertiesEditor from './components/PropertiesEditor.jsx';
import ConnectionsEditor from './components/ConnectionsEditor.jsx';
import DeskBuilderForm from './components/DeskBuilderForm.jsx';
import {
  CameraSetup,
  ConnectionsRenderer,
  DeskLabAxes,
  DeviceMesh,
  PowerStatusOverlay,
  RoomWalls,
} from './components/SceneObjects.jsx';

const PROJECT_DRAFT_STORAGE_KEY = 'desklab.project-draft.v1';
const getBrowserStorage = () => window.localStorage;
const projectClient = createLocalProjectClient(getBrowserStorage);
const projectDraftStorage = createProjectDraftStorage(
  getBrowserStorage,
  PROJECT_DRAFT_STORAGE_KEY
);

// Saves live only in this browser. Ask once that the browser keep them when
// it is short on space; it may say no, and saving works either way.
let persistentStorageRequested = false;
function requestPersistentStorage() {
  if (persistentStorageRequested) return;
  persistentStorageRequested = true;
  navigator.storage?.persist?.().catch(() => {});
}

const serializeLayout = (room, objects, connections) =>
  JSON.stringify({ room, objects, connections });

function downloadProject(project, prefix) {
  const exported = createProjectExport(project, { prefix });
  const blob = new Blob([exported.contents], { type: exported.mediaType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exported.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [room, setRoom] = useState({ length: 10, width: 10, height: 3 });
  const [objects, setObjects] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });
  const statusNotifierRef = useRef(null);
  if (statusNotifierRef.current === null) {
    statusNotifierRef.current = createStatusNotifier(setStatusMsg);
  }
  const showStatus = useCallback((status, duration) => {
    statusNotifierRef.current.show(status, duration);
  }, []);
  const [savedLayout, setSavedLayout] = useState(null);
  const [cameraDirty, setCameraDirty] = useState(false);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [projectLoadFailed, setProjectLoadFailed] = useState(false);
  const [backupRecoveryBusy, setBackupRecoveryBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const projectEditable = canEditProject({
    projectLoaded,
    projectLoadFailed,
    recoveryPending: Boolean(recoveryDraft),
  });
  
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const importInputRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const projectVersionRef = useRef(null);
  const [cameraConfig, setCameraConfig] = useState(undefined);
  const getCurrentCamera = useCallback(() =>
    captureCameraSnapshot(cameraRef.current, controlsRef.current, cameraConfig),
  [cameraConfig]);
  
  const [dragInfo, setDragInfo] = useState(null);
  const [inputRoom, setInputRoom] = useState({ length: 10, width: 10, height: 3 });
  const [showAxes, setShowAxes] = useState(true);
  // null while closed; otherwise the fixed-position anchor for the "更多" menu,
  // which must escape the toolbar's scroll container.
  const [moreMenuPosition, setMoreMenuPosition] = useState(null);
  const moreButtonRef = useRef(null);
  const moreMenuRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState(DEVICE_CATALOG[0].category);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  const [isPanelOpen, setIsPanelOpen] = useState(window.innerWidth >= 900);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(window.innerWidth >= 900);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('properties'); // 'properties' | 'connections'

  const handleToggleLeftPanel = () => {
    const nextState = !isLeftPanelOpen;
    setIsLeftPanelOpen(nextState);
    if (isMobile && nextState) {
      setIsPanelOpen(false);
    }
  };

  const handleToggleRightPanel = () => {
    const nextState = !isPanelOpen;
    setIsPanelOpen(nextState);
    if (isMobile && nextState) {
      setIsLeftPanelOpen(false);
    }
  };

  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionDraft, setConnectionDraft] = useState({});
  const [showGlobalConnections, setShowGlobalConnections] = useState(false);
  const [showWiringReport, setShowWiringReport] = useState(false);
  const [showLayoutReport, setShowLayoutReport] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [purchaseGuidance, setPurchaseGuidance] = useState(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState(null);

  const closeRecommendations = useCallback(() => {
    setPurchaseGuidance(null);
    setShowRecommendations(false);
  }, []);

  const projectStateRef = useRef({ room, objects, connections, selectedObjectId });
  const historyRef = useRef(null);
  if (historyRef.current === null) {
    historyRef.current = createProjectHistory();
  }
  const [historyStatus, setHistoryStatus] = useState({ canUndo: false, canRedo: false });
  const syncHistoryStatus = useCallback((nextStatus) => {
    setHistoryStatus(currentStatus =>
      currentStatus.canUndo === nextStatus.canUndo
        && currentStatus.canRedo === nextStatus.canRedo
        ? currentStatus
        : nextStatus
    );
  }, []);

  // StrictMode mounts, unmounts, and remounts in development; a notifier
  // disposed by the first cleanup would drop every later status, so each
  // mount gets its own.
  useEffect(() => {
    const notifier = createStatusNotifier(setStatusMsg);
    statusNotifierRef.current = notifier;
    return () => notifier.dispose();
  }, []);

  const isDirty = savedLayout !== null && (
    serializeLayout(room, objects, connections) !== savedLayout || cameraDirty
  );

  const readLocalDraft = useCallback(() => {
    const result = projectDraftStorage.read();
    if (result.ok) return result.draft;
    console.warn('Unable to read local project draft.', result.error);
    showStatus({
      text: '无法读取本地草稿；请尽快保存项目或导出备份，避免未保存修改丢失。',
      type: 'error',
    });
    return null;
  }, [showStatus]);

  const clearLocalDraft = useCallback(() => {
    const result = projectDraftStorage.clear();
    if (result.ok) return true;
    console.warn('Unable to clear local project draft.', result.error);
    showStatus({
      text: result.operation === 'clear-blocked'
        ? '本地草稿读取失败，已阻止清理以保留恢复材料；请尽快保存项目或导出备份。'
        : '本地草稿清理失败；请检查浏览器存储权限后重试。',
      type: 'error',
    });
    return false;
  }, [showStatus]);

  useEffect(() => {
    projectStateRef.current = { room, objects, connections, selectedObjectId };
  }, [room, objects, connections, selectedObjectId]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const cloneSnapshot = useCallback((value) => JSON.parse(JSON.stringify(value)), []);

  const resetHistory = useCallback(() => {
    syncHistoryStatus(historyRef.current.reset());
  }, [syncHistoryStatus]);

  const recordHistory = useCallback((groupKey = null, options = {}) => {
    syncHistoryStatus(historyRef.current.record(projectStateRef.current, {
      groupKey,
      ...options,
    }));
  }, [syncHistoryStatus]);

  const finishHistoryGroup = useCallback(() => {
    historyRef.current.finishGroup();
  }, []);

  const applyHistorySnapshot = useCallback((snapshot) => {
    const next = cloneSnapshot(snapshot);
    const restoresCamera = Object.hasOwn(next, 'camera');
    setRoom(next.room);
    setInputRoom(next.room);
    setObjects(next.objects);
    setConnections(next.connections);
    setSelectedObjectId(next.selectedObjectId || null);
    setConnectionMode(false);
    setConnectionDraft({});
    setHoveredDeviceId(null);
    setDragInfo(null);
    if (restoresCamera) {
      setCameraConfig(next.camera);
      setCameraDirty(Boolean(next.cameraDirty));
    }
    projectStateRef.current = {
      room: next.room,
      objects: next.objects,
      connections: next.connections,
      selectedObjectId: next.selectedObjectId || null,
    };
  }, [cloneSnapshot]);

  const handleUndo = useCallback(() => {
    if (!projectEditable) return;
    const result = historyRef.current.undo(projectStateRef.current, {
      camera: getCurrentCamera(),
      cameraDirty,
    });
    if (!result.snapshot) return;
    applyHistorySnapshot(result.snapshot);
    syncHistoryStatus(result.status);
  }, [applyHistorySnapshot, cameraDirty, getCurrentCamera, projectEditable, syncHistoryStatus]);

  const handleRedo = useCallback(() => {
    if (!projectEditable) return;
    const result = historyRef.current.redo(projectStateRef.current, {
      camera: getCurrentCamera(),
      cameraDirty,
    });
    if (!result.snapshot) return;
    applyHistorySnapshot(result.snapshot);
    syncHistoryStatus(result.status);
  }, [applyHistorySnapshot, cameraDirty, getCurrentCamera, projectEditable, syncHistoryStatus]);

  const updateConnectionsWithHistory = useCallback((updater) => {
    if (!projectEditable) return;
    const current = projectStateRef.current.connections;
    const next = typeof updater === 'function' ? updater(current) : updater;
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    recordHistory();
    setConnections(next);
  }, [projectEditable, recordHistory]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 899px)');
    const onChange = (e) => {
      setIsMobile(e.matches);
      if (e.matches) {
        setIsLeftPanelOpen(false);
        setIsPanelOpen(false);
      } else {
        setIsLeftPanelOpen(true);
        setIsPanelOpen(true);
      }
    };
    onChange(mql); // Initial check
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // 数据层核心更新函数：包含对象合并和统一验证约束
  const updateSelectedObject = useCallback((newProps) => {
    if (!projectEditable || !selectedObjectId) return;
    const obj = objects.find(item => item.id === selectedObjectId);
    if (!obj) return;

    const proposedObj = {
      ...obj,
      ...newProps,
      position: { ...obj.position, ...(newProps.position || {}) },
      scale: { ...obj.scale, ...(newProps.scale || {}) },
      rotation: { ...obj.rotation, ...(newProps.rotation || {}) },
    };

    proposedObj.scale.x = Math.max(0.05, proposedObj.scale.x);
    proposedObj.scale.y = Math.max(0.05, proposedObj.scale.y);
    proposedObj.scale.z = Math.max(0.05, proposedObj.scale.z);

    if (newProps.rotation) {
      proposedObj.rotation.z = safeClamp(proposedObj.rotation.z, 0, 360);
    }

    const { valid, object: constrainedObj, reason } = validateAndConstrainObject(proposedObj, room);
    if (!valid) {
      showStatus({ text: reason || "操作后超出房间边界", type: 'error' }, 3000);
      return;
    }
    if (JSON.stringify(obj) === JSON.stringify(constrainedObj)) return;

    const changedFields = Object.keys(newProps).sort().join(',');
    recordHistory(`object:${selectedObjectId}:${changedFields}`);
    setObjects(prev => prev.map(item => item.id === selectedObjectId ? constrainedObj : item));
  }, [objects, projectEditable, recordHistory, room, selectedObjectId, showStatus]);

  useEffect(() => {
    const controller = new AbortController();
    projectClient.load({ signal: controller.signal })
      .then(({ project: data, version }) => {
        if (controller.signal.aborted) return;
        projectVersionRef.current = version;
        setProjectLoadFailed(false);
        const loadedRoom = data.room || { length: 10, width: 10, height: 3 };
        const hydratedObjects = hydrateProjectObjects(data.objects || []);
        const loadedConnections = data.connections || [];

        setRoom(loadedRoom);
        setInputRoom(loadedRoom);
        setObjects(hydratedObjects);
        setConnections(loadedConnections);
        setCameraConfig(data.camera || null);
        setSavedLayout(serializeLayout(loadedRoom, hydratedObjects, loadedConnections));
        setCameraDirty(false);
        const localDraft = readLocalDraft();
        const loadedProject = {
          room: loadedRoom,
          objects: hydratedObjects,
          connections: loadedConnections,
          camera: data.camera || null,
        };
        if (localDraft && isDraftDifferent(localDraft, loadedProject)) {
          setRecoveryDraft(localDraft);
        } else {
          clearLocalDraft();
        }
        setProjectLoaded(true);
        resetHistory();
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        console.error(err);
        setProjectLoadFailed(true);
        showStatus({
          text: err.code === 'storage_unavailable'
            ? err.message
            : '本机保存的项目无法读取，已锁定保存以保护原数据。可以尝试恢复上一版本。',
          type: 'error',
        });
        const localDraft = readLocalDraft();
        if (localDraft) setRecoveryDraft(localDraft);
        setProjectLoaded(true);
      });
    return () => controller.abort();
  }, [clearLocalDraft, readLocalDraft, resetHistory, showStatus]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setDragInfo(null);
      finishHistoryGroup();
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [finishHistoryGroup]);

  useEffect(() => {
    const handleKeyDownEsc = (e) => {
      if (e.key === 'Escape') {
        if (connectionMode) {
          setConnectionMode(false);
          setConnectionDraft({});
          setHoveredDeviceId(null);
        }
        if (showGlobalConnections) {
          setShowGlobalConnections(false);
        }
        if (showWiringReport) {
          setShowWiringReport(false);
        }
        if (showLayoutReport) {
          setShowLayoutReport(false);
        }
        if (showRecommendations) {
          closeRecommendations();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDownEsc);
    return () => window.removeEventListener('keydown', handleKeyDownEsc);
  }, [closeRecommendations, connectionMode, showGlobalConnections, showWiringReport, showLayoutReport, showRecommendations]);

  useEffect(() => {
    const handleHistoryKeys = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (!(e.ctrlKey || e.metaKey)) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleHistoryKeys);
    return () => window.removeEventListener('keydown', handleHistoryKeys);
  }, [handleRedo, handleUndo]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (!projectEditable || !selectedObjectId || connectionMode) return;
      if (!canvasContainerRef.current || !canvasContainerRef.current.contains(e.target)) return;
      e.preventDefault(); 
      const multiplier = e.deltaY < 0 ? 1.05 : 0.95;
      
      const obj = objects.find(o => o.id === selectedObjectId);
      if (!obj) return;

      updateSelectedObject({ scale: { x: obj.scale.x * multiplier, y: obj.scale.y * multiplier, z: obj.scale.z * multiplier } });
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [selectedObjectId, objects, connectionMode, projectEditable, updateSelectedObject]);

  const handleDeleteDevice = useCallback(() => {
    if (!projectEditable || !selectedObjectId || connectionMode) return;
    const obj = objects.find(o => o.id === selectedObjectId);
    if (!obj) return;
    
    const relatedConnections = connections.filter(c => c.fromObjectId === selectedObjectId || c.toObjectId === selectedObjectId);
    
    const confirmMessage = relatedConnections.length > 0 
      ? `确定要删除设备“${obj.name}”吗？\n删除该设备将同时删除 ${relatedConnections.length} 条关联连接。`
      : `确定要删除设备“${obj.name}”吗？`;
      
    if (window.confirm(confirmMessage)) {
      recordHistory();
      setObjects(prev => prev.filter(o => o.id !== selectedObjectId));
      if (relatedConnections.length > 0) {
        setConnections(prev => prev.filter(c => c.fromObjectId !== selectedObjectId && c.toObjectId !== selectedObjectId));
      }
      setSelectedObjectId(null);
      setConnectionMode(false);
      setConnectionDraft({});
      setHoveredDeviceId(null);
      showStatus({ text: '删除成功', type: 'success' }, 3000);
    }
  }, [selectedObjectId, connectionMode, objects, connections, projectEditable, recordHistory, showStatus]);

  const handleDuplicateDevice = useCallback(() => {
    if (!projectEditable || !selectedObjectId || connectionMode) return;
    const obj = objects.find(o => o.id === selectedObjectId);
    if (!obj) return;

    // 1. 深拷贝设备全部字段
    const clonedObj = JSON.parse(JSON.stringify(obj));

    // 2. 生成全新的 object.id
    clonedObj.id = createEntityId(obj.type);

    // 3. 处理名称生成规则
    const match = obj.name.match(/^(.*?)\s+副本(?:\s+(\d+))?$/);
    const baseName = match ? match[1] : obj.name;
    const existingNames = new Set(objects.map(o => o.name));
    let newName = `${baseName} 副本`;
    if (existingNames.has(newName)) {
      let counter = 2;
      while (true) {
        const candidate = `${baseName} 副本 ${counter}`;
        if (!existingNames.has(candidate)) {
          newName = candidate;
          break;
        }
        counter++;
      }
    }
    clonedObj.name = newName;

    // 4. 边界处理与偏移规则
    const checkPositionValid = (pos) => {
      const proposed = {
        ...clonedObj,
        position: { ...clonedObj.position, ...pos }
      };
      const res = validateAndConstrainObject(proposed, room);
      if (!res.valid) return null;
      
      const dx = Math.abs(res.object.position.x - pos.x);
      const dy = Math.abs(res.object.position.y - pos.y);
      const dz = Math.abs(res.object.position.z - pos.z);
      if (dx < 1e-5 && dy < 1e-5 && dz < 1e-5) {
        return res.object;
      }
      return null;
    };

    const pos1 = { x: obj.position.x + 0.2, y: obj.position.y + 0.2, z: obj.position.z };
    const pos2 = { x: obj.position.x - 0.2, y: obj.position.y - 0.2, z: obj.position.z };

    const validatedObj = checkPositionValid(pos1) || checkPositionValid(pos2);

    if (validatedObj) {
      recordHistory();
      setObjects(prev => [...prev, validatedObj]);
      setSelectedObjectId(validatedObj.id);
      showStatus({ text: '复制成功', type: 'success' }, 3000);
    } else {
      showStatus({ text: '复制失败：超出房间边界', type: 'error' }, 3000);
    }
  }, [selectedObjectId, connectionMode, objects, projectEditable, room, recordHistory, showStatus]);

  const handleSnapSelectedOutlet = useCallback(() => {
    if (!projectEditable || !selectedObjectId || connectionMode) return;
    const object = objects.find(item => item.id === selectedObjectId);
    if (!object) return;
    const snapped = snapWallOutletToNearestWall(room, object);
    if (!snapped) {
      showStatus({ text: '当前房间尺寸无法容纳该墙壁插座', type: 'error' });
      return;
    }
    updateSelectedObject({ position: snapped.position, rotation: snapped.rotation });
    showStatus({ text: '已吸附到最近墙面', type: 'success' });
  }, [connectionMode, objects, projectEditable, room, selectedObjectId, showStatus, updateSelectedObject]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!projectEditable || !selectedObjectId || connectionMode) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handleDuplicateDevice();
        return;
      }

      if (e.key === 'Delete') {
        handleDeleteDevice();
        return;
      }

      const obj = objects.find(o => o.id === selectedObjectId);
      if (!obj) return;
      const update = getObjectKeyboardUpdate(obj, e);
      if (!update) return;
      e.preventDefault();
      updateSelectedObject(update);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, objects, connectionMode, handleDeleteDevice, handleDuplicateDevice, projectEditable, updateSelectedObject]);

  const handleResetView = () => {
    if (!projectEditable) return;
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, room.height * 1.8, -room.width * 1.6);
      controlsRef.current.target.set(0, room.height / 2, 0);
      controlsRef.current.update();
      setCameraDirty(true);
    }
  };

  const handleCameraInteractionEnd = useCallback(() => {
    if (projectEditable) setCameraDirty(true);
  }, [projectEditable]);

  useEffect(() => {
    if (!projectLoaded || recoveryDraft) return undefined;
    if (!isDirty) {
      clearLocalDraft();
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const draft = createProjectDraft({
        room,
        objects,
        connections,
        camera: getCurrentCamera(),
      });
      const result = projectDraftStorage.write(draft);
      if (!result.ok) {
        console.warn('Unable to save local project draft.', result.error);
        showStatus({
          text: '本地草稿保存失败；请立即保存项目或导出备份。',
          type: 'error',
        });
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [clearLocalDraft, connections, getCurrentCamera, isDirty, objects, projectLoaded, recoveryDraft, room, showStatus]);

  const handleSave = async () => {
    if (!projectLoaded) {
      showStatus({
        text: '项目仍在加载，已阻止保存以保护现有数据。',
        type: 'error',
      });
      return;
    }
    if (projectLoadFailed) {
      showStatus({
        text: '本机保存的项目无法读取，为保护原数据已禁止保存。',
        type: 'error',
      });
      return;
    }
    if (recoveryDraft) {
      showStatus({
        text: '请先恢复或放弃本地草稿，再保存项目。',
        type: 'error',
      });
      return;
    }
    if (saveInFlightRef.current) return;

    const currentCamera = getCurrentCamera();
    const snapshot = { room, objects, connections, camera: currentCamera };
    const layoutSnapshot = serializeLayout(room, objects, connections);
    saveInFlightRef.current = true;
    setSaveBusy(true);
    showStatus({ text: '正在保存', type: 'success' });

    try {
      const saved = await projectClient.save(snapshot, projectVersionRef.current);
      projectVersionRef.current = saved.version;
      requestPersistentStorage();

      const latest = projectStateRef.current;
      const latestProject = {
        room: latest.room,
        objects: latest.objects,
        connections: latest.connections,
        camera: getCurrentCamera(),
      };
      const latestLayout = serializeLayout(latest.room, latest.objects, latest.connections);
      const isLayoutUnchanged = latestLayout === layoutSnapshot;
      const cameraUnchanged = JSON.stringify(latestProject.camera || null)
        === JSON.stringify(currentCamera || null);
      const fullyCurrent = isLayoutUnchanged;

      setSavedLayout(layoutSnapshot);
      if (isLayoutUnchanged || cameraUnchanged) {
        setCameraDirty(false);
      }
      setRecoveryDraft(null);
      const draftCleared = !fullyCurrent || clearLocalDraft();
      setShowBackupReminder(shouldRemindBackup({
        objectCount: saved.project.objects.length,
        state: readBackupReminderState(getBrowserStorage),
        now: new Date(),
      }));
      showStatus(
        fullyCurrent && !draftCleared
          ? { text: '项目已保存，但本地草稿清理失败；刷新前请检查浏览器存储权限。', type: 'error' }
          : {
              text: fullyCurrent ? '已保存' : '已保存请求时的版本，当前仍有未保存修改',
              type: 'success',
            },
        3000
      );
    } catch (error) {
      showStatus({ text: error.message || '保存失败', type: 'error' }, 3000);
    } finally {
      saveInFlightRef.current = false;
      setSaveBusy(false);
    }
  };

  const handleRecoverBackup = async () => {
    const confirmed = window.confirm(
      '确定恢复上一次成功保存的项目吗？\n当前无法读取的项目将被上一版本替换。'
    );
    if (!confirmed) return;

    setBackupRecoveryBusy(true);
    try {
      await projectClient.recoverBackup();
      showStatus({ text: '上一版本已恢复，正在重新载入项目', type: 'success' });
      window.location.reload();
    } catch (error) {
      showStatus({ text: error.message || '备份恢复失败', type: 'error' });
    } finally {
      setBackupRecoveryBusy(false);
    }
  };

  const handleRestoreDraft = async () => {
    if (!recoveryDraft) return;
    try {
      const result = await projectClient.validate(recoveryDraft.project);

      const restoredObjects = hydrateProjectObjects(result.objects || []);
      const restoredConnections = result.connections || [];
      if (savedLayout === null) {
        setSavedLayout(serializeLayout(room, objects, connections));
      }
      recordHistory(null, {
        includeCamera: true,
        camera: getCurrentCamera(),
        cameraDirty,
      });
      setRoom(result.room);
      setInputRoom(result.room);
      setObjects(restoredObjects);
      setConnections(restoredConnections);
      setCameraConfig(result.camera || null);
      setCameraDirty(true);
      setSelectedObjectId(null);
      setConnectionMode(false);
      setConnectionDraft({});
      setRecoveryDraft(null);
      showStatus({ text: '已恢复本地草稿，请确认后保存', type: 'success' }, 4000);
    } catch (error) {
      showStatus({ text: error.message || '本地草稿恢复失败', type: 'error' }, 4000);
    }
  };

  const handleDiscardDraft = () => {
    if (!clearLocalDraft()) return;
    setRecoveryDraft(null);
    showStatus({ text: '已放弃本地草稿', type: 'success' }, 3000);
  };

  const handleExportProject = () => {
    if (!projectEditable) return;
    downloadProject({
      room,
      objects,
      camera: getCurrentCamera(),
      connections,
    }, 'desklab-project');
    recordBackupExport(getBrowserStorage, new Date());
    setShowBackupReminder(false);
    showStatus({ text: '备份已导出', type: 'success' }, 3000);
  };

  const handleSnoozeBackupReminder = () => {
    snoozeBackupReminder(getBrowserStorage, new Date());
    setShowBackupReminder(false);
  };

  const handleExportRecoveryDraft = () => {
    if (!recoveryDraft) return;
    downloadProject(recoveryDraft.project, 'desklab-recovery');
    showStatus({ text: '本地草稿已导出，原草稿仍保留', type: 'success' }, 4000);
  };

  const handleImportProject = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (!projectEditable) {
      input.value = '';
      return;
    }

    try {
      assertProjectImportSize(file.size);
      const parsed = JSON.parse(await file.text());
      const result = await projectClient.validate(parsed);

      const shouldImport = window.confirm(
        `确定导入“${file.name}”并替换当前画布吗？\n导入后仍需点击“保存项目”才会保存。`
      );
      if (!shouldImport) return;

      const importedObjects = hydrateProjectObjects(result.objects || []);
      const importedConnections = result.connections || [];
      if (savedLayout === null) {
        setSavedLayout(serializeLayout(room, objects, connections));
      }
      recordHistory(null, {
        includeCamera: true,
        camera: getCurrentCamera(),
        cameraDirty,
      });
      setRoom(result.room);
      setInputRoom(result.room);
      setObjects(importedObjects);
      setConnections(importedConnections);
      setCameraConfig(result.camera || null);
      setCameraDirty(true);
      setSelectedObjectId(null);
      setConnectionMode(false);
      setConnectionDraft({});
      setHoveredDeviceId(null);
      showStatus({ text: '备份已导入，尚未保存', type: 'success' }, 3000);
    } catch (error) {
      showStatus({ text: `导入失败：${describeProjectImportError(error)}`, type: 'error' }, 5000);
    } finally {
      input.value = '';
    }
  };

  const handleApplyTemplate = (template) => {
    const scene = buildTemplateScene(template.id);
    if (scene) applyGeneratedScene(scene, `已套用模板“${template.name}”`);
  };

  const applyGeneratedScene = (scene, label) => {
    if (!projectEditable) return;
    if (savedLayout === null) {
      setSavedLayout(serializeLayout(room, objects, connections));
    }
    recordHistory(null, {
      includeCamera: true,
      camera: getCurrentCamera(),
      cameraDirty,
    });
    setRoom(scene.room);
    setInputRoom(scene.room);
    setObjects(scene.objects);
    setConnections(scene.connections);
    setCameraConfig(scene.camera);
    setCameraDirty(true);
    setSelectedObjectId(null);
    setConnectionMode(false);
    setConnectionDraft({});
    setHoveredDeviceId(null);
    setShowTemplates(false);
    showStatus({ text: `${label}，可按实际情况调整，尚未保存`, type: 'success' }, 4000);
  };

  const handleCopyProjectToClipboard = async () => {
    if (!projectEditable) return;
    try {
      const currentCamera = getCurrentCamera();
      const project = { room, objects, connections, camera: currentCamera };
      await navigator.clipboard.writeText(JSON.stringify(project, null, 2));
      showStatus({ text: '项目已复制，可以粘贴到别处', type: 'success' }, 3000);
    } catch (error) {
      showStatus({ text: `复制失败：${error.message}`, type: 'error' }, 4000);
    }
  };

  const handlePasteProjectFromClipboard = async () => {
    if (!projectEditable) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        throw new Error('剪贴板中未发现内容');
      }
      assertProjectImportSize(getProjectImportByteLength(text));
      const parsed = JSON.parse(text);
      const result = await projectClient.validate(parsed);

      const shouldImport = window.confirm(
        '确定从剪贴板导入项目并替换当前画布吗？\n导入后仍需点击“保存项目”才会保存。'
      );
      if (!shouldImport) return;

      const importedObjects = hydrateProjectObjects(result.objects || []);
      const importedConnections = result.connections || [];
      if (savedLayout === null) {
        setSavedLayout(serializeLayout(room, objects, connections));
      }
      recordHistory(null, {
        includeCamera: true,
        camera: getCurrentCamera(),
        cameraDirty,
      });
      setRoom(result.room);
      setInputRoom(result.room);
      setObjects(importedObjects);
      setConnections(importedConnections);
      setCameraConfig(result.camera || null);
      setCameraDirty(true);
      setSelectedObjectId(null);
      setConnectionMode(false);
      setConnectionDraft({});
      setHoveredDeviceId(null);
      showStatus({ text: '项目已粘贴，尚未保存', type: 'success' }, 3000);
    } catch (error) {
      showStatus({ text: `粘贴失败：${describeProjectImportError(error)}`, type: 'error' }, 5000);
    }
  };

  const handleAddDevice = useCallback((modelTemplate, categoryId) => {
    if (!projectEditable) return null;
    const result = placeCatalogObject({
      modelTemplate,
      categoryId,
      room,
      objects,
    });
    if (!result.valid) {
      showStatus({ text: `无法添加${modelTemplate.displayName}：${result.reason}`, type: 'error' }, 4000);
      return null;
    }

    recordHistory();
    const nextObjects = [...objects, result.object];
    setObjects(nextObjects);
    // Real devices are already plugged in and cabled: draw the new device's
    // power, video and network lines for the user where a free port exists.
    const newLines = buildConnectionCompletion({ room, objects: nextObjects, connections }, result.object.id);
    if (newLines.length > 0) setConnections([...connections, ...newLines]);
    setSelectedObjectId(result.object.id);
    return result.object;
  }, [connections, objects, projectEditable, recordHistory, room, showStatus]);

  const handleAddRecommendedDevice = useCallback((modelId, categoryId) => {
    if (!projectEditable) return;
    const template = findModelTemplate({ modelId });
    if (!template) return;
    const addedObject = handleAddDevice(template, categoryId);
    const guidance = getPurchaseGuidance(modelId);
    if (!addedObject || !guidance) return;
    setPurchaseGuidance({ ...guidance, objectId: addedObject.id });
    setShowRecommendations(true);
    showStatus({ text: `已添加${template.displayName}，请按下一步完成布线`, type: 'success' }, 4000);
  }, [handleAddDevice, projectEditable, showStatus]);

  const handleAddRecommendedPowerStrip = useCallback(() => {
    handleAddRecommendedDevice('power-strip', 'power');
  }, [handleAddRecommendedDevice]);

  const handleUpdateRoom = () => {
    if (!projectEditable) return;
    const result = constrainProjectToRoom(inputRoom, objects);
    if (!result.valid) {
      showStatus({ text: result.reason, type: 'error' }, 4000);
      return;
    }

    if (JSON.stringify(room) === JSON.stringify(result.room) &&
        JSON.stringify(objects) === JSON.stringify(result.objects)) return;
    recordHistory();
    setRoom(result.room);
    setInputRoom(result.room);
    setObjects(result.objects);
    showStatus({ text: '房间尺寸已更新', type: 'success' }, 3000);
  };

  const selectedObj = objects.find(o => o.id === selectedObjectId);
  const selectionHint = describeSelectionHint({
    selectedName: selectedObj ? selectedObj.name : null,
    isMobile,
  });
  const wiringIssues = useMemo(
    () => analyzeProjectWiring(objects, connections),
    [objects, connections]
  );
  const wiringSummary = useMemo(() => summarizeWiringIssues(wiringIssues), [wiringIssues]);
  const invalidConnectionIds = useMemo(() => getInvalidConnectionIds(wiringIssues), [wiringIssues]);
  const invalidConnectionCount = useMemo(() => {
    const invalidIds = new Set(invalidConnectionIds);
    return connections.filter(connection => invalidIds.has(connection.id)).length;
  }, [connections, invalidConnectionIds]);

  const handleStartPurchaseWiring = () => {
    if (!purchaseGuidance) return;
    setSelectedObjectId(purchaseGuidance.objectId);
    setActiveTab('connections');
    setIsPanelOpen(true);
    if (isMobile) setIsLeftPanelOpen(false);
    closeRecommendations();
  };

  const actionableWiringIssueCount = wiringSummary.error + wiringSummary.warning;
  const layoutIssues = useMemo(() => analyzeProjectLayout(room, objects), [room, objects]);
  const layoutSummary = useMemo(() => summarizeLayoutIssues(layoutIssues), [layoutIssues]);
  const actionableLayoutIssueCount = layoutSummary.error + layoutSummary.warning;
  const recommendations = useMemo(
    () => buildRecommendations({ room, objects, connections }, { wiringIssues }),
    [room, objects, connections, wiringIssues]
  );
  const shoppingList = useMemo(
    () => buildShoppingList(recommendations.purchases),
    [recommendations.purchases]
  );

  const handleCopyShoppingList = async () => {
    try {
      await navigator.clipboard.writeText(shoppingList.text);
      showStatus({ text: '购物清单已复制', type: 'success' }, 3000);
    } catch (error) {
      showStatus({ text: `复制失败：${error.message}`, type: 'error' }, 4000);
    }
  };

  const handleCleanupInvalidConnections = () => {
    if (!projectEditable || invalidConnectionCount === 0) return;
    const confirmed = window.confirm(
      `确定删除 ${invalidConnectionCount} 条无效连接吗？\n只会清理引用缺失、端口错误、类型冲突或重复占用的连接；该操作可以撤销。`
    );
    if (!confirmed) return;
    const invalidIds = new Set(invalidConnectionIds);
    updateConnectionsWithHistory(current => current.filter(connection => !invalidIds.has(connection.id)));
    showStatus({ text: `已清理 ${invalidConnectionCount} 条无效连接`, type: 'success' });
  };

  const handleApplyAutoFixes = (codes) => {
    if (!projectEditable) return;
    const suggestions = buildFreeImprovements(room, objects, connections)
      .filter(suggestion => codes.includes(suggestion.code));
    if (suggestions.length === 0) return;
    const next = applyAllImprovements({ room, objects, connections }, suggestions);
    recordHistory();
    setObjects(next.objects);
    setConnections(next.connections);
    showStatus({ text: `已自动应用 ${suggestions.length} 项改进建议`, type: 'success' });
  };

  const layoutAutoFixCodes = ['drop_to_support', 'move_inside_room', 'snap_outlet_to_wall'];
  const layoutAutoFixableCount = layoutIssues.filter(issue =>
    issue.code === 'floating_object' || issue.code === 'out_of_bounds' || issue.code === 'outlet_off_wall'
  ).length;
  const cableAutoFixableCount = wiringIssues.filter(issue =>
    issue.code === 'short_cable' || issue.code === 'low_cable_slack'
  ).length;

  const handleExtendCableToRecommended = (connectionId) => {
    if (!projectEditable) return;
    const suggestion = buildFreeImprovements(room, objects, connections)
      .find(item => item.code === 'extend_cable' && item.patch.connectionId === connectionId);
    if (!suggestion) {
      showStatus({ text: '无法为该线材计算推荐长度', type: 'error' });
      return;
    }
    updateConnectionsWithHistory(current => current.map(connection =>
      connection.id === connectionId
        ? { ...connection, length: suggestion.patch.length }
        : connection));
    showStatus({ text: `线材已延长到约 ${suggestion.patch.length}m`, type: 'success' });
  };

  const handleAutoConnectNetwork = (suggestionId) => {
    if (!projectEditable) return;
    const suggestion = buildFreeImprovements(room, objects, connections)
      .find(item => item.id === suggestionId);
    if (!suggestion) return;
    recordHistory();
    const next = applyImprovement({ room, objects, connections }, suggestion);
    setConnections(next.connections);
    showStatus({ text: '已自动连接网络', type: 'success' });
  };

  const handleAutoConnectDisplay = (suggestionId) => {
    if (!projectEditable) return;
    const suggestion = buildFreeImprovements(room, objects, connections)
      .find(item => item.id === suggestionId);
    if (!suggestion) return;
    recordHistory();
    const next = applyImprovement({ room, objects, connections }, suggestion);
    setConnections(next.connections);
    showStatus({ text: '已自动连接显示器', type: 'success' });
  };

  const handleDropObjectToSupport = (objectId) => {
    if (!projectEditable) return;
    const object = objects.find(candidate => candidate.id === objectId);
    if (!object) return;
    const snapped = snapObjectToSupport(room, object, objects);
    if (!snapped) {
      showStatus({ text: '无法为该物体找到可用支撑面', type: 'error' });
      return;
    }
    if (Math.abs(snapped.position.z - object.position.z) <= 1e-5) return;
    recordHistory();
    setObjects(current => current.map(candidate => candidate.id === objectId ? snapped : candidate));
    setSelectedObjectId(objectId);
    showStatus({ text: '物体已落到下方支撑面', type: 'success' });
  };

  const handleMoveObjectInsideRoom = (objectId) => {
    if (!projectEditable) return;
    const object = objects.find(candidate => candidate.id === objectId);
    if (!object) return;
    const constrained = validateAndConstrainObject(object, room);
    if (!constrained.valid) {
      showStatus({ text: '该物体尺寸超出房间，无法自动移回', type: 'error' });
      return;
    }
    recordHistory();
    setObjects(current => current.map(candidate => candidate.id === objectId ? constrained.object : candidate));
    setSelectedObjectId(objectId);
    showStatus({ text: '物体已移回房间边界内', type: 'success' });
  };

  const closeMoreMenu = useCallback(({ restoreFocus = false } = {}) => {
    setMoreMenuPosition(null);
    if (restoreFocus) moreButtonRef.current?.focus();
  }, []);

  const handleToggleMoreMenu = () => {
    if (moreMenuPosition) {
      closeMoreMenu();
      return;
    }
    const rect = moreButtonRef.current.getBoundingClientRect();
    const menuWidth = 160;
    setMoreMenuPosition({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
    });
  };

  const runMoreMenuAction = (action) => {
    closeMoreMenu();
    action();
  };

  useEffect(() => {
    if (!moreMenuPosition) return undefined;
    const handlePointerDown = (event) => {
      if (moreMenuRef.current?.contains(event.target) || moreButtonRef.current?.contains(event.target)) return;
      closeMoreMenu();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMoreMenu({ restoreFocus: true });
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMoreMenu, moreMenuPosition]);

  const handleSnapOutletToWall = (objectId) => {
    if (!projectEditable) return;
    const object = objects.find(candidate => candidate.id === objectId);
    if (!object) return;
    const snapped = snapWallOutletToNearestWall(room, object);
    if (!snapped) {
      showStatus({ text: '当前房间尺寸无法容纳该墙壁插座', type: 'error' });
      return;
    }
    recordHistory();
    setObjects(current => current.map(candidate => candidate.id === objectId ? snapped : candidate));
    setSelectedObjectId(objectId);
    showStatus({ text: '墙壁插座已吸附到最近墙面', type: 'success' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      {/* 顶部控制栏 */}
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, minWidth: 0, maxHeight: '40vh', overflowY: 'auto', background: '#f5f5f5' }}>
        <div className="toolbar">
          {/* 1. 项目与房间 */}
          <div className="toolbar-group">
            <span className="toolbar-label">DeskLab MVP</span>
            <label htmlFor="room-length" style={{ fontSize: '13px' }}>长:</label>
            <input id="room-length" type="number" min="0.1" step="0.1" className="ui-input" value={inputRoom.length} onChange={e => setInputRoom({ ...inputRoom, length: Number(e.target.value) })} style={{ width: '60px' }} disabled={!projectEditable} />
            <label htmlFor="room-width" style={{ fontSize: '13px' }}>宽:</label>
            <input id="room-width" type="number" min="0.1" step="0.1" className="ui-input" value={inputRoom.width} onChange={e => setInputRoom({ ...inputRoom, width: Number(e.target.value) })} style={{ width: '60px' }} disabled={!projectEditable} />
            <label htmlFor="room-height" style={{ fontSize: '13px' }}>高:</label>
            <input id="room-height" type="number" min="0.1" step="0.1" className="ui-input" value={inputRoom.height} onChange={e => setInputRoom({ ...inputRoom, height: Number(e.target.value) })} style={{ width: '60px' }} disabled={!projectEditable} />
            <button className="ui-button" onClick={handleUpdateRoom} disabled={!projectEditable}>更新房间</button>
            <button className="ui-button" onClick={() => setShowTemplates(true)} disabled={!projectEditable}>桌面模板</button>
          </div>

          {/* 3. 全局操作 */}
          <div className="toolbar-group global-actions">
            <button className="ui-button" onClick={handleUndo} disabled={!projectEditable || !historyStatus.canUndo} title="撤销 (Ctrl+Z)">撤销</button>
            <button className="ui-button" onClick={handleRedo} disabled={!projectEditable || !historyStatus.canRedo} title="重做 (Ctrl+Y)">重做</button>
            <button className="ui-button" onClick={handleResetView} disabled={!projectEditable}>重置视角</button>
            <button className="ui-button" onClick={() => setShowGlobalConnections(true)}>所有连接</button>
            <button className="ui-button" onClick={() => setShowLayoutReport(true)}>
              布局检查{actionableLayoutIssueCount > 0 ? ` (${actionableLayoutIssueCount})` : ''}
            </button>
            <button className="ui-button" onClick={() => setShowWiringReport(true)}>
              布线检查{actionableWiringIssueCount > 0 ? ` (${actionableWiringIssueCount})` : ''}
            </button>
            <button className="ui-button ui-button-recommend" onClick={() => setShowRecommendations(true)}>
              改进建议{recommendations.total > 0 ? ` (${recommendations.total})` : ''}
            </button>
            <button
              ref={moreButtonRef}
              type="button"
              className="ui-button"
              onClick={handleToggleMoreMenu}
              aria-haspopup="menu"
              aria-expanded={moreMenuPosition !== null}
            >
              更多
            </button>
            {moreMenuPosition && (
              <div
                ref={moreMenuRef}
                className="toolbar-menu"
                role="menu"
                aria-label="更多"
                style={{ top: moreMenuPosition.top, left: moreMenuPosition.left }}
              >
                <button
                  type="button"
                  className="toolbar-menu-item"
                  role="menuitemcheckbox"
                  aria-checked={showAxes}
                  onClick={() => setShowAxes(current => !current)}
                >
                  <span className={`toolbar-menu-check${showAxes ? ' is-checked' : ''}`} aria-hidden="true" />
                  显示坐标轴
                </button>
                <div className="toolbar-menu-separator" role="separator" />
                <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(() => importInputRef.current?.click())} disabled={!projectEditable}>导入备份</button>
                <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(handleExportProject)} disabled={!projectEditable}>导出备份</button>
                <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(handlePasteProjectFromClipboard)} disabled={!projectEditable} title="粘贴别人分享或从另一台设备复制的项目">粘贴项目</button>
                <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(handleCopyProjectToClipboard)} disabled={!projectEditable} title="复制项目，可以粘贴给别人或另一台设备">复制项目</button>
              </div>
            )}
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportProject}
              style={{ display: 'none' }}
              aria-label="导入 DeskLab 备份文件"
            />
            <button className="ui-button" onClick={handleToggleLeftPanel}>
              {isLeftPanelOpen ? '收起资产库' : '展开资产库'}
            </button>
            <button className="ui-button" onClick={handleToggleRightPanel}>
              {isPanelOpen ? '收起属性面板' : '展开属性面板'}
            </button>
            {isDirty && <span className="unsaved-indicator" role="status">● 未保存</span>}
            <button
              className="ui-button ui-button-primary"
              onClick={handleSave}
              disabled={!projectEditable || saveBusy}
              title={!projectLoaded
                ? '项目仍在加载，保存暂不可用'
                : projectLoadFailed
                  ? '本机保存的项目无法读取，为防止覆盖原数据，保存已锁定'
                  : recoveryDraft
                    ? '请先恢复或放弃本地草稿'
                  : saveBusy
                    ? '项目正在保存'
                    : '保存项目'}
            >
              {!projectLoaded ? '加载中…' : saveBusy ? '保存中…' : '保存项目'}
            </button>
            {statusMsg.text && (
              <span style={{ color: statusMsg.type === 'error' ? '#dc3545' : '#28a745', fontSize: '13px', fontWeight: 'bold' }}>
                {statusMsg.type === 'error' ? '⚠️ ' : '✅ '}{statusMsg.text}
              </span>
            )}
          </div>
        </div>

        {recoveryDraft && (
          <div className="draft-recovery-banner" role="alert">
            <div>
              <strong>发现未保存的本地草稿</strong>
              <span>保存于 {new Date(recoveryDraft.savedAt).toLocaleString()}</span>
            </div>
            <div className="draft-recovery-actions">
              <button type="button" className="ui-button ui-button-primary" onClick={handleRestoreDraft}>恢复草稿</button>
              <button type="button" className="ui-button" onClick={handleExportRecoveryDraft}>导出草稿</button>
              <button type="button" className="ui-button" onClick={handleDiscardDraft}>放弃</button>
            </div>
          </div>
        )}

        {showBackupReminder && !recoveryDraft && !projectLoadFailed && (
          <div className="draft-recovery-banner" role="region" aria-label="备份提醒">
            <div>
              <strong>建议导出一份备份</strong>
              <span>桌面只保存在这个浏览器里，清理浏览器数据或换设备后就找不到了。需要时可用“更多 → 导入备份”恢复。</span>
            </div>
            <div className="draft-recovery-actions">
              <button type="button" className="ui-button ui-button-primary" onClick={handleExportProject}>导出备份</button>
              <button type="button" className="ui-button" onClick={handleSnoozeBackupReminder}>以后再说</button>
            </div>
          </div>
        )}

        {projectLoadFailed && (
          <div className="draft-recovery-banner" role="alert">
            <div>
              <strong>本机保存的项目无法读取，保存已锁定</strong>
              <span>可尝试恢复上一次成功保存的版本；本地未保存草稿不会被删除。</span>
            </div>
            <div className="draft-recovery-actions">
              <button
                type="button"
                className="ui-button ui-button-danger"
                onClick={handleRecoverBackup}
                disabled={backupRecoveryBusy}
              >
                {backupRecoveryBusy ? '正在恢复…' : '恢复上一版本'}
              </button>
            </div>
          </div>
        )}

        <div className={`selection-hint${selectedObj ? ' selection-hint-active' : ''}`}>
          <span className="selection-hint-title">{selectionHint.title}</span>
          {selectionHint.tip && <span className="selection-hint-tip">{selectionHint.tip}</span>}
        </div>
      </div>

        {/* 主体布局：左侧 3D Canvas + 右侧属性面板 */}
      <div
        inert={!projectEditable}
        aria-disabled={!projectEditable}
        aria-busy={!projectLoaded}
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          pointerEvents: projectEditable ? 'auto' : 'none',
          opacity: projectEditable ? 1 : 0.65,
        }}
      >
        
        {connectionMode && (
          <div style={{ position: 'absolute', top: 15, left: '50%', transform: 'translateX(-50%)', background: '#ff9800', color: 'white', padding: '10px 20px', borderRadius: '20px', zIndex: 100, fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            请点击 3D 画布中的目标设备 (按 Esc 取消)
          </div>
        )}

        {isLeftPanelOpen && (
          <div className="left-panel">
            <div className="left-panel-header">
              <div className="left-panel-title">资产库</div>
              <button onClick={() => setIsLeftPanelOpen(false)} className="side-panel-close" aria-label="关闭资产库" title="关闭">×</button>
            </div>
            <div className="asset-search-container">
              <input 
                type="text" 
                placeholder="搜索设备名称、类型、型号..." 
                className="ui-input" 
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="asset-category-list">
              {DEVICE_CATALOG.map(cat => (
                <button 
                  key={cat.category} 
                  type="button"
                  className={`asset-category-btn ${selectedCategory === cat.category ? 'asset-category-btn-active' : ''}`}
                  onClick={() => { setSelectedCategory(cat.category); setSearchQuery(''); }}
                >
                  {cat.categoryName}
                </button>
              ))}
            </div>
            <div className="asset-list">
              {(() => {
                const query = searchQuery.trim().toLowerCase();
                let matchedModels = [];
                if (query) {
                  DEVICE_CATALOG.forEach(cat => {
                    cat.models.forEach(m => {
                      if (
                        m.displayName.toLowerCase().includes(query) ||
                        m.type.toLowerCase().includes(query) ||
                        m.modelId.toLowerCase().includes(query) ||
                        describeCatalogModel(m).toLowerCase().includes(query)
                      ) {
                        matchedModels.push({ ...m, categoryId: cat.category });
                      }
                    });
                  });
                } else {
                  const cat = DEVICE_CATALOG.find(c => c.category === selectedCategory);
                  if (cat) {
                    matchedModels = cat.models.map(m => ({ ...m, categoryId: cat.category }));
                  }
                }

                if (matchedModels.length === 0) {
                  return <div className="empty-state" style={{ marginTop: '20px' }}>未找到匹配的设备</div>;
                }

                return matchedModels.map((m, idx) => (
                  <button type="button" key={`${m.modelId}-${idx}`} className="asset-item" onClick={() => handleAddDevice(m, m.categoryId)} disabled={!projectEditable}>
                    <div className="asset-item-title">{m.displayName}</div>
                    <div className="asset-item-subtitle">{describeCatalogModel(m)}</div>
                  </button>
                ));
              })()}
            </div>
          </div>
        )}

        {/* 左侧/中间：3D 视图 */}
        <div ref={canvasContainerRef} style={{ flex: 1, position: 'relative', cursor: dragInfo ? 'grabbing' : 'default', minWidth: 0, minHeight: 0 }}>
          <Canvas onPointerMissed={() => {
            if (!connectionMode) setSelectedObjectId(null);
          }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <CameraSetup cameraConfig={cameraConfig} room={room} controlsRef={controlsRef} cameraRef={cameraRef} />
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enabled={projectEditable && !dragInfo && !connectionMode}
              enableZoom={!selectedObjectId && !connectionMode}
              onEnd={handleCameraInteractionEnd}
            />

            {dragInfo && (
              <mesh
                rotation={[-Math.PI / 2, 0, 0]} position={[0, dragInfo.planeY, 0]}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  const obj = objects.find(o => o.id === dragInfo.objId);
                  if (!obj) return;
                  updateSelectedObject({ position: { x: e.point.x + dragInfo.offsetX, y: e.point.z + dragInfo.offsetY } });
                }}
                onPointerUp={(e) => { e.stopPropagation(); setDragInfo(null); finishHistoryGroup(); }}
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

            {(() => {
              const isConnectionTab = isPanelOpen && activeTab === 'connections';
              const relatedIds = new Set();
              if (isConnectionTab && selectedObjectId) {
                connections.forEach(c => {
                  if (c.fromObjectId === selectedObjectId) relatedIds.add(c.toObjectId);
                  if (c.toObjectId === selectedObjectId) relatedIds.add(c.fromObjectId);
                });
              }

              return objects.map(obj => (
                <DeviceMesh 
                  key={obj.id}
                  obj={obj}
                  isSelected={selectedObjectId === obj.id}
                  isRelated={relatedIds.has(obj.id)}
                  isHovered={connectionMode && hoveredDeviceId === obj.id && obj.id !== selectedObjectId}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    const clickAction = getCanvasObjectClickAction({
                      projectEditable,
                      connectionMode,
                      objectId: obj.id,
                      selectedObjectId,
                    });
                    if (clickAction === 'ignore') return;
                    if (clickAction === 'choose-connection-target') {
                      setConnectionDraft(prev => ({ ...prev, toObjectId: obj.id, toPortId: '' }));
                      setConnectionMode(false);
                      setHoveredDeviceId(null);
                      return;
                    }
                    setSelectedObjectId(obj.id);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (!canStartObjectDrag({ projectEditable, connectionMode })) return;
                    finishHistoryGroup();
                    setSelectedObjectId(obj.id);
                    setDragInfo({ objId: obj.id, planeY: e.point.y, offsetX: obj.position.x - e.point.x, offsetY: obj.position.y - e.point.z });
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    if (projectEditable && connectionMode) setHoveredDeviceId(obj.id);
                  }}
                  onPointerOut={(e) => {
                    e.stopPropagation();
                    if (projectEditable && connectionMode && hoveredDeviceId === obj.id) setHoveredDeviceId(null);
                  }}
                />
              ));
            })()}
          </Canvas>
        </div>

        {/* 右侧：面板 */}
        {isPanelOpen && (
          <div className="side-panel">
            <div className="side-panel-tabs" role="tablist">
              <button 
                type="button"
                role="tab"
                aria-selected={activeTab === 'properties'}
                className={`side-panel-tab ${activeTab === 'properties' ? 'side-panel-tab-active' : ''}`}
                onClick={() => setActiveTab('properties')}
              >
                属性
              </button>
              <button 
                type="button"
                role="tab"
                aria-selected={activeTab === 'connections'}
                className={`side-panel-tab ${activeTab === 'connections' ? 'side-panel-tab-active' : ''}`}
                onClick={() => setActiveTab('connections')}
              >
                连接
              </button>
              <button onClick={() => setIsPanelOpen(false)} className="side-panel-close" aria-label="关闭面板" title="关闭面板">×</button>
            </div>

            <div className="side-panel-content">
              {activeTab === 'properties' && (
                selectedObj ? (
                  <PropertiesEditor
                    obj={selectedObj}
                    updateObject={updateSelectedObject}
                    room={room}
                    onSnapToWall={handleSnapSelectedOutlet}
                    objects={objects}
                    connections={connections}
                  />
                ) : (
                  <div className="empty-state">
                    <strong>未选中设备</strong><br />
                    请在左侧 3D 画布中<br />点击任意设备以编辑其属性。
                  </div>
                )
              )}
              {activeTab === 'connections' && (
                <ConnectionsEditor 
                  objects={objects} 
                  connections={connections} 
                  setConnections={updateConnectionsWithHistory}
                  selectedObj={selectedObj}
                  connectionMode={connectionMode}
                  setConnectionMode={setConnectionMode}
                  connectionDraft={connectionDraft}
                  setConnectionDraft={setConnectionDraft}
                />
              )}
            </div>

            {activeTab === 'properties' && selectedObj && (
              <div className="side-panel-footer">
                <button 
                  type="button"
                  onClick={handleDuplicateDevice} 
                  className="ui-button" 
                  style={{ flex: 1 }}
                >
                  复制设备
                </button>
                <button 
                  type="button"
                  onClick={handleDeleteDevice} 
                  className="ui-button ui-button-danger" 
                  style={{ flex: 1 }}
                >
                  删除设备
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {showTemplates && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowTemplates(false);
          }}
        >
          <div
            className="modal-container wiring-report"
            role="dialog"
            aria-modal="true"
            aria-labelledby="templates-title"
          >
            <div className="modal-header">
              <h3 id="templates-title" className="modal-title">桌面模板</h3>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="side-panel-close"
                aria-label="关闭桌面模板"
                title="关闭"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="template-intro">
                选一个最接近你现状的模板，系统会摆好设备并接好电源、显示和网线，之后可以按实际情况调整。
                {objects.length > 0 && ' 套用后会替换当前场景，可以用“撤销”恢复。'}
              </p>
              <div className="template-list">
                {DESK_TEMPLATES.map(template => (
                  <div key={template.id} className="template-card">
                    <div className="template-card-content">
                      <div className="template-card-title">{template.name}</div>
                      <div className="template-card-description">{template.description}</div>
                      <div className="template-card-devices">
                        {`书桌 ${template.desk.length}m × ${template.desk.depth}m · `}
                        {template.devices
                          .map(device => `${findModelTemplate({ modelId: device.modelId })?.displayName ?? device.modelId} ×${device.count}`)
                          .join(' · ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ui-button ui-button-primary"
                      onClick={() => handleApplyTemplate(template)}
                      disabled={!projectEditable}
                      aria-label={`使用模板：${template.name}`}
                    >
                      使用这个模板
                    </button>
                  </div>
                ))}
              </div>
              <h4 className="template-section-title">按我的设备生成</h4>
              <DeskBuilderForm
                disabled={!projectEditable}
                onGenerate={scene => applyGeneratedScene(scene, '已按你的设备生成桌面')}
              />
            </div>
          </div>
        </div>
      )}

      {showLayoutReport && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowLayoutReport(false);
          }}
        >
          <div
            className="modal-container wiring-report"
            role="dialog"
            aria-modal="true"
            aria-labelledby="layout-report-title"
          >
            <div className="modal-header">
              <h3 id="layout-report-title" className="modal-title">布局检查</h3>
              <button
                type="button"
                onClick={() => setShowLayoutReport(false)}
                className="side-panel-close"
                aria-label="关闭布局检查"
                title="关闭"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="wiring-summary">
                <span className="wiring-summary-error">严重 {layoutSummary.error}</span>
                <span className="wiring-summary-warning">警告 {layoutSummary.warning}</span>
                <span className="wiring-summary-info">提示 {layoutSummary.info}</span>
                {layoutAutoFixableCount > 0 && (
                  <button
                    type="button"
                    className="ui-button ui-button-primary wiring-cleanup-button"
                    onClick={() => handleApplyAutoFixes(layoutAutoFixCodes)}
                    disabled={!projectEditable}
                  >
                    一键修复可处理项 ({layoutAutoFixableCount})
                  </button>
                )}
              </div>

              {layoutIssues.length === 0 ? (
                <div className="empty-state" style={{ marginTop: '24px' }}>
                  当前未发现可识别的布局问题。
                </div>
              ) : (
                <div className="wiring-issue-list">
                  {layoutIssues.map(issue => (
                    <div key={issue.id} className={`wiring-issue wiring-issue-${issue.severity}`}>
                      <div className="wiring-issue-content">
                        <div className="wiring-issue-title">
                          <span className="wiring-issue-severity">
                            {issue.severity === 'error' ? '严重' : issue.severity === 'warning' ? '警告' : '提示'}
                          </span>
                          {issue.title}
                        </div>
                        <div className="wiring-issue-description">{issue.description}</div>
                      </div>
                      <div className="connection-item-actions">
                        {issue.code === 'floating_object' && (
                          <button
                            type="button"
                            className="ui-button ui-button-primary"
                            onClick={() => handleDropObjectToSupport(issue.objectIds[0])}
                          >
                            落到表面
                          </button>
                        )}
                        {issue.code === 'out_of_bounds' && (
                          <button
                            type="button"
                            className="ui-button ui-button-primary"
                            onClick={() => handleMoveObjectInsideRoom(issue.objectIds[0])}
                          >
                            移回房间内
                          </button>
                        )}
                        {issue.code === 'outlet_off_wall' && (
                          <button
                            type="button"
                            className="ui-button ui-button-primary"
                            onClick={() => handleSnapOutletToWall(issue.objectIds[0])}
                          >
                            贴到墙面
                          </button>
                        )}
                        <button
                          type="button"
                          className="ui-button"
                          onClick={() => {
                            setSelectedObjectId(issue.objectIds[0]);
                            setActiveTab('properties');
                            setIsPanelOpen(true);
                            if (isMobile) setIsLeftPanelOpen(false);
                            setShowLayoutReport(false);
                          }}
                        >
                          定位
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="wiring-disclaimer">
                相交检查基于物体旋转后的轴对齐包围盒，适合作为布局预警；复杂模型仍应结合 3D 视图确认。
              </p>
            </div>
          </div>
        </div>
      )}

      {showWiringReport && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowWiringReport(false);
          }}
        >
          <div
            className="modal-container wiring-report"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wiring-report-title"
          >
            <div className="modal-header">
              <h3 id="wiring-report-title" className="modal-title">布线检查</h3>
              <button
                type="button"
                onClick={() => setShowWiringReport(false)}
                className="side-panel-close"
                aria-label="关闭布线检查"
                title="关闭"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="wiring-summary">
                <span className="wiring-summary-error">严重 {wiringSummary.error}</span>
                <span className="wiring-summary-warning">警告 {wiringSummary.warning}</span>
                <span className="wiring-summary-info">提示 {wiringSummary.info}</span>
                {invalidConnectionCount > 0 && (
                  <button
                    type="button"
                    className="ui-button ui-button-danger wiring-cleanup-button"
                    onClick={handleCleanupInvalidConnections}
                  >
                    清理无效连接 ({invalidConnectionCount})
                  </button>
                )}
                {cableAutoFixableCount > 0 && (
                  <button
                    type="button"
                    className="ui-button ui-button-primary wiring-cleanup-button"
                    onClick={() => handleApplyAutoFixes(['extend_cable'])}
                    disabled={!projectEditable}
                  >
                    一键延长过短线材 ({cableAutoFixableCount})
                  </button>
                )}
              </div>

              {wiringIssues.length === 0 ? (
                <div className="empty-state" style={{ marginTop: '24px' }}>
                  当前未发现可识别的布线问题。
                </div>
              ) : (
                <div className="wiring-issue-list">
                  {wiringIssues.map(issue => (
                    <div key={issue.id} className={`wiring-issue wiring-issue-${issue.severity}`}>
                      <div className="wiring-issue-content">
                        <div className="wiring-issue-title">
                          <span className="wiring-issue-severity">
                            {issue.severity === 'error' ? '严重' : issue.severity === 'warning' ? '警告' : '提示'}
                          </span>
                          {issue.title}
                        </div>
                        <div className="wiring-issue-description">{issue.description}</div>
                      </div>
                      {(issue.code === 'short_cable' || issue.code === 'low_cable_slack') && (
                        <button
                          type="button"
                          className="ui-button ui-button-primary"
                          onClick={() => handleExtendCableToRecommended(issue.connectionIds[0])}
                        >
                          延长到推荐长度
                        </button>
                      )}
                      {issue.code === 'power_strip_chain' && (
                        <button
                          type="button"
                          className="ui-button"
                          onClick={() => { handleAddRecommendedPowerStrip(); setShowWiringReport(false); }}
                          title="向场景中加入一个孔位更多的插排，替代串联的插排"
                        >
                          换孔位更多的插排
                        </button>
                      )}
                      {(issue.code === 'power_overload' || issue.code === 'power_warning') && (
                        <button
                          type="button"
                          className="ui-button"
                          onClick={() => { handleAddRecommendedPowerStrip(); setShowWiringReport(false); }}
                          title="加购插排以将部分用电器分流到其他电源"
                        >
                          加购插排分流
                        </button>
                      )}
                      {issue.objectIds.length > 0 && (
                        <button
                          type="button"
                          className="ui-button"
                          onClick={() => {
                            setSelectedObjectId(issue.objectIds[0]);
                            setActiveTab(issue.connectionIds.length > 0 ? 'connections' : 'properties');
                            setIsPanelOpen(true);
                            if (isMobile) setIsLeftPanelOpen(false);
                            setShowWiringReport(false);
                          }}
                        >
                          定位
                        </button>
                      )}
                      {issue.objectIds.length === 0 && issue.connectionIds.length > 0 && (
                        <button
                          type="button"
                          className="ui-button"
                          onClick={() => {
                            setShowWiringReport(false);
                            setShowGlobalConnections(true);
                          }}
                        >
                          查看连接
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="wiring-disclaimer">
                本检查仅基于当前设备、端口和桌面外部连接数据，不涉及墙内线路，也不能替代专业电工评估。
              </p>
            </div>
          </div>
        </div>
      )}

      {showGlobalConnections && (
        <div 
          className="modal-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowGlobalConnections(false);
            }
          }}
        >
          <div 
            className="modal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-connections-title"
          >
            <div className="modal-header">
              <h3 id="global-connections-title" className="modal-title">全部连接清单</h3>
              <button 
                type="button" 
                onClick={() => setShowGlobalConnections(false)} 
                className="side-panel-close" 
                aria-label="关闭全部连接清单"
                title="关闭"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {connections.length === 0 ? (
                <div className="empty-state" style={{ marginTop: '20px' }}>当前没有任何连接</div>
              ) : (
                <table className="modal-table">
                  <thead>
                    <tr>
                      <th style={{ padding: '8px' }}>起点</th>
                      <th style={{ padding: '8px' }}>终点</th>
                      <th style={{ padding: '8px' }}>线材/长度</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map(c => {
                      const fromObj = objects.find(o => o.id === c.fromObjectId);
                      const toObj = objects.find(o => o.id === c.toObjectId);
                      const fromPortName = fromObj?.ports?.find(p => p.id === c.fromPortId)?.name || c.fromPortId || '旧连接';
                      const toPortName = toObj?.ports?.find(p => p.id === c.toPortId)?.name || c.toPortId || '旧连接';
                      const lengthStatus = evaluateConnectionLength(c, objects);
                      
                      return (
                        <tr key={c.id}>
                          <td style={{ padding: '8px' }}>
                            <strong>{fromObj?.name || '未知'}</strong><br/>
                            <span style={{ color: '#666', fontSize: '11px' }}>{fromPortName}</span>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <strong>{toObj?.name || '未知'}</strong><br/>
                            <span style={{ color: '#666', fontSize: '11px' }}>{toPortName}</span>
                          </td>
                          <td style={{ padding: '8px' }}>
                            {c.name}<br/>
                            <span style={{ color: '#666', fontSize: '11px' }}>{c.cableType} ({c.length}m)</span>
                            {lengthStatus && (
                              <div className={`cable-distance ${lengthStatus.hasRecommendedSlack ? 'cable-distance-ok' : 'cable-distance-warning'}`}>
                                端点 {lengthStatus.distance.toFixed(2)}m / 建议 {lengthStatus.recommendedLength.toFixed(2)}m
                                {!lengthStatus.hasRecommendedSlack && (
                                  lengthStatus.sufficient ? '，维护余量不足' : `，直连不足 ${Math.abs(lengthStatus.slack).toFixed(2)}m`
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            <button 
                              type="button"
                              onClick={() => updateConnectionsWithHistory(prev => prev.filter(x => x.id !== c.id))}
                              className="ui-button ui-button-danger"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecommendations && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeRecommendations();
          }}
        >
          <div
            className="modal-container wiring-report"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recommendations-title"
          >
            <div className="modal-header">
              <h3 id="recommendations-title" className="modal-title">自动检查与改进建议</h3>
              <button
                type="button"
                onClick={closeRecommendations}
                className="side-panel-close"
                aria-label="关闭改进建议"
                title="关闭"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="wiring-issue-description">
                根据当前设备、位置和连接规则生成建议；实际摆放、走线和设备规格仍需确认。
              </p>
              <div className="wiring-summary">
                <span className="wiring-summary-info">免费改进 {recommendations.freeImprovements.length}</span>
                <span className="wiring-summary-warning">加购建议 {recommendations.purchases.length}</span>
                {recommendations.freeImprovements.length > 0 && (
                  <button
                    type="button"
                    className="ui-button ui-button-primary wiring-cleanup-button"
                    onClick={() => {
                      if (!projectEditable) return;
                      const next = applyAllAvailableImprovements({ room, objects, connections });
                      recordHistory();
                      setObjects(next.objects);
                      setConnections(next.connections);
                      showStatus({ text: '已自动应用所有可用免费改进', type: 'success' });
                    }}
                    disabled={!projectEditable}
                  >
                    一键修复所有免费项 ({recommendations.freeImprovements.length})
                  </button>
                )}
              </div>

              {(actionableLayoutIssueCount + actionableWiringIssueCount) > 0 && (
                <div className="wiring-issue wiring-issue-warning" role="status">
                  <div className="wiring-issue-content">
                    <div className="wiring-issue-title">
                      还有 {actionableLayoutIssueCount + actionableWiringIssueCount} 项检查问题需要处理
                    </div>
                    <div className="wiring-issue-description">
                      自动建议仅覆盖部分问题。应用后请继续查看检查报告，确认需要手动调整的项目。
                    </div>
                    <div className="connection-item-actions">
                      {actionableLayoutIssueCount > 0 && (
                        <button type="button" className="ui-button" onClick={() => {
                          closeRecommendations();
                          setShowLayoutReport(true);
                        }}>
                          查看布局问题 ({actionableLayoutIssueCount})
                        </button>
                      )}
                      {actionableWiringIssueCount > 0 && (
                        <button type="button" className="ui-button" onClick={() => {
                          closeRecommendations();
                          setShowWiringReport(true);
                        }}>
                          查看布线问题 ({actionableWiringIssueCount})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {purchaseGuidance && (
                <div className="wiring-issue wiring-issue-info" style={{ marginTop: '16px' }}>
                  <div className="wiring-issue-content">
                    <div className="wiring-issue-title">{purchaseGuidance.title}</div>
                    <div className="wiring-issue-description">{purchaseGuidance.description}</div>
                  </div>
                  <div className="connection-item-actions">
                    <button type="button" className="ui-button ui-button-primary" onClick={handleStartPurchaseWiring}>
                      {purchaseGuidance.actionLabel}
                    </button>
                  </div>
                </div>
              )}

              {recommendations.total === 0 ? (
                <div className="empty-state" style={{ marginTop: '24px' }}>
                  {objects.length === 0 ? (
                    <>
                      <p>先添加设备，建立你的桌面方案。</p>
                      <p>可以直接套用一个桌面模板再调整，也可以从资产库逐件放入设备并设置连接。</p>
                      <div className="empty-state-actions">
                        <button type="button" className="ui-button ui-button-primary" disabled={!projectEditable} onClick={() => {
                          closeRecommendations();
                          setShowTemplates(true);
                        }}>
                          使用桌面模板
                        </button>
                        <button type="button" className="ui-button" disabled={!projectEditable} onClick={() => {
                          closeRecommendations();
                          setIsLeftPanelOpen(true);
                          if (isMobile) setIsPanelOpen(false);
                        }}>
                          添加第一件设备
                        </button>
                      </div>
                    </>
                  ) : (actionableLayoutIssueCount + actionableWiringIssueCount) > 0
                    ? '暂无自动改进或加购建议，请查看上方检查问题并手动处理。'
                    : '当前检查未发现需要处理的问题，暂无自动改进或加购建议。'}
                </div>
              ) : (
                <div className="recommendations-sections" style={{ marginTop: '16px' }}>
                  {recommendations.freeImprovements.length > 0 && (
                    <div className="recommendation-group">
                      <h4>免费布局与配线优化</h4>
                      <div className="wiring-issue-list">
                        {recommendations.freeImprovements.map(issue => (
                          <div key={issue.id} className="wiring-issue wiring-issue-info">
                            <div className="wiring-issue-content">
                              <div className="wiring-issue-title">
                                {issue.title}
                              </div>
                              <div className="wiring-issue-description">{issue.description}</div>
                            </div>
                            <div className="connection-item-actions">
                              {issue.code === 'drop_to_support' && (
                                <button
                                  type="button"
                                  className="ui-button ui-button-primary"
                                  onClick={() => handleDropObjectToSupport(issue.objectIds[0])}
                                  disabled={!projectEditable}
                                >
                                  落到表面
                                </button>
                              )}
                              {issue.code === 'move_inside_room' && (
                                <button
                                  type="button"
                                  className="ui-button ui-button-primary"
                                  onClick={() => handleMoveObjectInsideRoom(issue.objectIds[0])}
                                  disabled={!projectEditable}
                                >
                                  移回房间内
                                </button>
                              )}
                              {issue.code === 'snap_outlet_to_wall' && (
                                <button
                                  type="button"
                                  className="ui-button ui-button-primary"
                                  onClick={() => handleSnapOutletToWall(issue.objectIds[0])}
                                  disabled={!projectEditable}
                                >
                                  贴到墙面
                                </button>
                              )}
                              {issue.code === 'extend_cable' && (
                                <button
                                  type="button"
                                  className="ui-button ui-button-primary"
                                  onClick={() => handleExtendCableToRecommended(issue.connectionIds[0])}
                                  disabled={!projectEditable}
                                >
                                  延长线材
                                </button>
                              )}
                              {issue.code === 'auto_network_device' && (
                                <button
                                  type="button"
                                  className="ui-button ui-button-primary"
                                  onClick={() => handleAutoConnectNetwork(issue.id)}
                                  disabled={!projectEditable}
                                >
                                  连接网络
                                </button>
                              )}
                              {issue.code === 'auto_connect_display' && (
                                <button
                                  type="button"
                                  className="ui-button ui-button-primary"
                                  onClick={() => handleAutoConnectDisplay(issue.id)}
                                  disabled={!projectEditable}
                                >
                                  连接显示器
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendations.purchases.length > 0 && (
                    <div className="recommendation-group" style={{ marginTop: '24px' }}>
                      <h4>推荐加购商品</h4>
                      {shoppingList.items.length > 0 && (
                        <div className="shopping-list" role="group" aria-label="购物清单">
                          <div className="shopping-list-header">
                            <span className="shopping-list-title">购物清单</span>
                            <button type="button" className="ui-button" onClick={handleCopyShoppingList}>复制清单</button>
                          </div>
                          <ul className="shopping-list-items">
                            {shoppingList.items.map(item => (
                              <li key={item.key} className={item.optional ? 'shopping-list-optional' : undefined}>
                                <span>{item.optional ? `可选：${item.name}` : item.name}</span>
                                <span className="shopping-list-quantity">×{item.quantity}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="wiring-issue-list">
                        {recommendations.purchases.map(issue => (
                          <div key={issue.id} className={`wiring-issue ${issue.code === 'split_overloaded_power' ? 'wiring-issue-error' : 'wiring-issue-warning'}`}>
                            <div className="wiring-issue-content">
                              <div className="wiring-issue-title">
                                {issue.title}
                              </div>
                              <div className="wiring-issue-description">{issue.description}</div>
                            </div>
                            <div className="connection-item-actions">
                              {issue.code === 'fix_power_strip_chain' && (
                                <button
                                  type="button"
                                  className="ui-button ui-button-primary"
                                  onClick={handleAddRecommendedPowerStrip}
                                  disabled={!projectEditable}
                                >
                                  加购插排
                                </button>
                              )}
                              {issue.code === 'buy_cable' && (
                                <button
                                  type="button"
                                  className="ui-button ui-button-primary"
                                  onClick={() => { handleExtendCableToRecommended(issue.connectionIds[0]); }}
                                  disabled={!projectEditable}
                                >
                                  采纳并更新长度
                                </button>
                              )}
                              {issue.code === 'buy_power_strip_for_outlets' && (
                                <button
                                  type="button"
                                  className="ui-button ui-button-primary"
                                  onClick={handleAddRecommendedPowerStrip}
                                  disabled={!projectEditable}
                                >
                                  加购插排
                                </button>
                              )}
                              {issue.code === 'split_overloaded_power' && (
                                <>
                                  <button
                                    type="button"
                                    className="ui-button ui-button-primary"
                                    onClick={handleAddRecommendedPowerStrip}
                                    disabled={!projectEditable}
                                  >
                                    加购插排分流
                                  </button>
                                  {issue.objectIds?.length > 0 && (
                                    <button
                                      type="button"
                                      className="ui-button"
                                      onClick={() => {
                                        setSelectedObjectId(issue.objectIds[0]);
                                        setActiveTab('properties');
                                        setIsPanelOpen(true);
                                        if (isMobile) setIsLeftPanelOpen(false);
                                        closeRecommendations();
                                      }}
                                    >
                                      定位
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
