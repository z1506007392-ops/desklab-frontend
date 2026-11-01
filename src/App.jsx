import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { UNSAVED_PROJECT_VERSION, createLocalProjectClient } from './domain/local-project-store.js';
import {
  analyzeProjectWiring,
  getInvalidConnectionIds,
  summarizeWiringIssues,
} from './domain/analysis.js';
import { constrainProjectToRoom, safeClamp, validateAndConstrainObject } from './domain/geometry.js';
import {
  analyzeProjectLayout,
  settleAfterDrag,
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
  findModelTemplate,
  hydrateProjectObjects,
} from './domain/catalog.js';
import LibraryBrowser from './components/LibraryBrowser.jsx';
import { captureCameraSnapshot } from './domain/camera-snapshot.js';
import { placeCatalogObject } from './domain/placement.js';
import { createEntityId } from './domain/identifiers.js';
import { describeKeyTarget, getObjectKeyboardUpdate, shouldIgnoreDeviceShortcut } from './domain/keyboard-controls.js';
import { cameraZoomEnabled } from './domain/view-controls.js';
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
import { buildTemplateScene } from './domain/desk-templates.js';
import { buildShoppingList } from './domain/shopping-list.js';
import { buildCableShoppingList } from './domain/cable-shopping-list.js';
import { labelObjectsForPicker } from './domain/object-labels.js';
import { hasSeenGuide, markGuideSeen } from './domain/onboarding.js';
import { SHARE_LINK_MESSAGES, decodeShareLink, encodeShareLink } from './domain/share-link.js';
import { applyAllAvailableImprovements, applyAllImprovements, applyImprovement, buildConnectionCompletion, buildFreeImprovements, buildRecommendations } from './domain/recommendations.js';
import { createProjectHistory } from './domain/project-history.js';
import { createStatusNotifier } from './domain/status-notifier.js';
import PropertiesEditor from './components/PropertiesEditor.jsx';
import ConnectionsEditor from './components/ConnectionsEditor.jsx';
import AboutDialog from './components/AboutDialog.jsx';
import TemplateDialog from './components/TemplateDialog.jsx';
import LayoutReportDialog from './components/LayoutReportDialog.jsx';
import WiringReportDialog from './components/WiringReportDialog.jsx';
import ConnectionsListDialog from './components/ConnectionsListDialog.jsx';
import CableShoppingDialog from './components/CableShoppingDialog.jsx';
import ShareLinkDialog from './components/ShareLinkDialog.jsx';
import ShareViewBanner from './components/ShareViewBanner.jsx';
import OnboardingGuide from './components/OnboardingGuide.jsx';
import ErrorNotice from './components/ErrorNotice.jsx';
import DraftRecoveryBanner from './components/DraftRecoveryBanner.jsx';
import BackupReminderBanner from './components/BackupReminderBanner.jsx';
import AiPreviewBanner from './components/AiPreviewBanner.jsx';
import CorruptSaveBanner from './components/CorruptSaveBanner.jsx';
import ConnectionModeBanner from './components/ConnectionModeBanner.jsx';
import SelectionHint from './components/SelectionHint.jsx';
import StatusToast from './components/StatusToast.jsx';
import AppToolbar from './components/AppToolbar.jsx';
import LazyScene3D from './components/LazyScene3D.jsx';


import { SceneErrorBoundary, SceneUnavailable } from './components/SceneFallback.jsx';
import RecommendationsDialog from './components/RecommendationsDialog.jsx';
import { useAiLayoutAssistant } from './components/useAiLayoutAssistant.js';
import { canUseWebGL } from './domain/webgl-support.js';
import { CountBadge } from './components/CountBadge.jsx';
import { CloseIcon } from './components/Icons.jsx';

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
// Name of a toolbar button that shows a count badge, e.g. "布局检查 (2)".
function countLabel(text, count) {
  return count > 0 ? `${text} (${count})` : undefined;
}

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
  // While an AI suggestion is previewed in 3D, editing waits until the user
  // applies or cancels it.
  const [aiPreview, setAiPreview] = useState(null);
  const projectBaseEditable = canEditProject({
    projectLoaded,
    projectLoadFailed,
    recoveryPending: Boolean(recoveryDraft),
  });
  // A share link is viewed in memory only. It must not become the saved project.
  const [shareView, setShareView] = useState(false);
  const projectEditable = projectBaseEditable && !aiPreview && !shareView;
  
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const importInputRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const projectVersionRef = useRef(null);
  const visitorLayoutRef = useRef(null);
  const storedLoadFailedRef = useRef(false);
  const [cameraConfig, setCameraConfig] = useState(undefined);
  const getCurrentCamera = useCallback(() =>
    captureCameraSnapshot(cameraRef.current, controlsRef.current, cameraConfig),
  [cameraConfig]);
  
  const [dragInfo, setDragInfo] = useState(null);
  const [gizmoMode, setGizmoMode] = useState('translate');
  const [gizmoModeFor, setGizmoModeFor] = useState(null);
  const activeGizmoMode = gizmoModeFor === selectedObjectId ? gizmoMode : 'translate';
  const [gizmoDragging, setGizmoDragging] = useState(false);
  const gizmoDragRef = useRef(null);
  // The device drag in progress, readable from the window-level pointerup that
  // ends a drag released outside the 3D view.
  const dragInfoRef = useRef(null);
  const [inputRoom, setInputRoom] = useState({ length: 10, width: 10, height: 3 });
  const [showAxes, setShowAxes] = useState(true);
  // null while closed; otherwise the fixed-position anchor for the "更多" menu,
  // which must escape the toolbar's scroll container.
  const [moreMenuPosition, setMoreMenuPosition] = useState(null);
  const moreButtonRef = useRef(null);
  const moreMenuRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  const [isRoomEditorOpen, setIsRoomEditorOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(window.innerWidth >= 900);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(window.innerWidth >= 900);
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
  const [showCableShop, setShowCableShop] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [showWiringReport, setShowWiringReport] = useState(false);
  const [showLayoutReport, setShowLayoutReport] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [webglAvailable] = useState(() => canUseWebGL());
  // First-visit guide: only for a project that has never been saved, until
  // the user picks a way to start or something appears in the room.
  const [hasSavedProject, setHasSavedProject] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const guideDismissedRef = useRef(false);
  const [scrollTemplatesToBuilder, setScrollTemplatesToBuilder] = useState(false);
  const [purchaseGuidance, setPurchaseGuidance] = useState(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState(null);

  const aiAssistant = useAiLayoutAssistant();
  const currentProject = useMemo(() => ({ room, objects, connections }), [room, objects, connections]);

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

  const currentLayoutSnapshot = useMemo(
    () => serializeLayout(room, objects, connections),
    [room, objects, connections],
  );
  const isDirty = savedLayout !== null && (
    currentLayoutSnapshot !== savedLayout || cameraDirty
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
  // `history` lets a caller choose the undo group, e.g. a drag keeps one held
  // group from pointer down to pointer up however long it takes.
  const updateSelectedObject = useCallback((newProps, history = {}) => {
    if (!projectEditable || !selectedObjectId) return null;
    const obj = objects.find(item => item.id === selectedObjectId);
    if (!obj) return null;

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
      return null;
    }
    if (JSON.stringify(obj) === JSON.stringify(constrainedObj)) return obj;

    const changedFields = Object.keys(newProps).sort().join(',');
    recordHistory(history.groupKey ?? `object:${selectedObjectId}:${changedFields}`, { holdGroup: Boolean(history.holdGroup) });
    setObjects(prev => prev.map(item => item.id === selectedObjectId ? constrainedObj : item));
    return constrainedObj;
  }, [objects, projectEditable, recordHistory, room, selectedObjectId, showStatus]);

  const chooseGizmoMode = (mode) => {
    setGizmoMode(mode);
    setGizmoModeFor(selectedObjectId);
  };

  const handleGizmoChange = useCallback((update) => {
    if (!selectedObjectId) return null;
    const patch = activeGizmoMode === 'rotate'
      ? { rotation: { z: update.rotationZ } }
      : { position: update.position };
    return updateSelectedObject(patch, { groupKey: `drag:${selectedObjectId}`, holdGroup: true });
  }, [activeGizmoMode, selectedObjectId, updateSelectedObject]);

  const handleGizmoDragStart = useCallback(() => {
    finishHistoryGroup();
    const current = objects.find(item => item.id === selectedObjectId);
    gizmoDragRef.current = {
      id: selectedObjectId,
      mode: activeGizmoMode,
      startPosition: current ? { ...current.position } : null,
    };
    setGizmoDragging(true);
  }, [activeGizmoMode, finishHistoryGroup, objects, selectedObjectId]);

  const handleGizmoDragEnd = useCallback(() => {
    const drag = gizmoDragRef.current;
    gizmoDragRef.current = null;
    if (drag?.startPosition && drag.mode !== 'rotate') {
      const latest = projectStateRef.current;
      const dragged = latest.objects.find(item => item.id === drag.id);
      const settled = dragged && settleAfterDrag(latest.room, dragged, latest.objects, drag.startPosition);
      if (settled) setObjects(current => current.map(item => item.id === settled.id ? settled : item));
    }
    finishHistoryGroup();
    setGizmoDragging(false);
  }, [finishHistoryGroup]);

  useEffect(() => {
    const controller = new AbortController();
    const hash = window.location.hash;
    Promise.all([
      projectClient.load({ signal: controller.signal }).then(
        result => ({ ok: true, result }),
        error => ({ ok: false, error }),
      ),
      decodeShareLink(hash),
    ]).then(([stored, shared]) => {
      if (controller.signal.aborted) return;
      if (stored.ok) {
        const data = stored.result.project;
        const loadedRoom = data.room || { length: 10, width: 10, height: 3 };
        const hydratedObjects = hydrateProjectObjects(data.objects || []);
        const loadedConnections = data.connections || [];
        projectVersionRef.current = stored.result.version;
        setHasSavedProject(stored.result.version !== UNSAVED_PROJECT_VERSION);
        storedLoadFailedRef.current = false;
        visitorLayoutRef.current = serializeLayout(loadedRoom, hydratedObjects, loadedConnections);
      } else {
        storedLoadFailedRef.current = true;
        visitorLayoutRef.current = null;
      }

      // The shared desk replaces only what is on screen. Storage is not written.
      if (shared.kind === 'ok') {
        const sharedRoom = shared.project.room;
        const sharedObjects = hydrateProjectObjects(shared.project.objects || []);
        const sharedConnections = shared.project.connections || [];
        setProjectLoadFailed(false);
        setRoom(sharedRoom);
        setInputRoom(sharedRoom);
        setObjects(sharedObjects);
        setConnections(sharedConnections);
        setCameraConfig(shared.project.camera || null);
        setSavedLayout(serializeLayout(sharedRoom, sharedObjects, sharedConnections));
        setCameraDirty(false);
        setShareView(true);
        setProjectLoaded(true);
        resetHistory();
        return;
      }

      const shareNotice = shared.kind === 'absent' ? '' : SHARE_LINK_MESSAGES[shared.kind];
      if (!stored.ok) {
        const err = stored.error;
        console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
        setProjectLoadFailed(true);
        const storedNotice = err.code === 'storage_unavailable'
          ? err.message
          : '本机保存的项目无法读取，已锁定保存以保护原数据。可以尝试恢复上一版本。';
        showStatus({ text: shareNotice ? `${shareNotice} ${storedNotice}` : storedNotice, type: 'error' });
        const localDraft = readLocalDraft();
        if (localDraft) setRecoveryDraft(localDraft);
        setProjectLoaded(true);
        return;
      }

      if (shareNotice) showStatus({ text: shareNotice, type: 'error' }, 6000);
      const data = stored.result.project;
      const loadedRoom = data.room || { length: 10, width: 10, height: 3 };
      const hydratedObjects = hydrateProjectObjects(data.objects || []);
      const loadedConnections = data.connections || [];
      setProjectLoadFailed(false);
      setRoom(loadedRoom);
      setInputRoom(loadedRoom);
      setObjects(hydratedObjects);
      setConnections(loadedConnections);
      setCameraConfig(data.camera || null);
      setSavedLayout(visitorLayoutRef.current);
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
    });
    return () => controller.abort();
  }, [clearLocalDraft, readLocalDraft, resetHistory, showStatus]);

  useEffect(() => {
    dragInfoRef.current = dragInfo;
  }, [dragInfo]);

  // Ends a device drag wherever the pointer is let go: on the 3D view (the
  // drag plane's pointerup) or outside it (the window's). A device dragged off
  // its support drops instead of hanging in the air; the drag's held history
  // group already has the undo step. The window also hears pointerups that
  // end on the canvas, so the second call finds no drag and only closes the
  // group again.
  const endObjectDrag = useCallback(() => {
    const drag = dragInfoRef.current;
    dragInfoRef.current = null;
    if (drag) {
      const latest = projectStateRef.current;
      const dragged = latest.objects.find(item => item.id === drag.objId);
      const settled = dragged && settleAfterDrag(latest.room, dragged, latest.objects, drag.startPosition);
      if (settled) setObjects(current => current.map(item => (item.id === settled.id ? settled : item)));
    }
    setDragInfo(null);
    finishHistoryGroup();
  }, [finishHistoryGroup]);

  useEffect(() => {
    window.addEventListener('pointerup', endObjectDrag);
    return () => window.removeEventListener('pointerup', endObjectDrag);
  }, [endObjectDrag]);

  // Layout effects, not passive ones: the share dialog opens after an await,
  // and a passive effect would re-subscribe only after the dialog is already
  // on screen, so an Escape (or a device key) pressed in that moment reached
  // the old listener and was missed (E32).
  useLayoutEffect(() => {
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
        if (showCableShop) {
          setShowCableShop(false);
        }
        if (shareLink) {
          setShareLink(null);
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
        if (showAbout) {
          setShowAbout(false);
        }
        if (showTemplates) {
          setScrollTemplatesToBuilder(false);
          setShowTemplates(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDownEsc);
    return () => window.removeEventListener('keydown', handleKeyDownEsc);
  }, [closeRecommendations, connectionMode, shareLink, showAbout, showCableShop, showGlobalConnections, showWiringReport, showLayoutReport, showRecommendations, showTemplates]);

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

  const dialogOpen = showTemplates || showLayoutReport || showWiringReport || showGlobalConnections || showCableShop || shareLink || showRecommendations || showAbout || guideOpen;

  useLayoutEffect(() => {
    const handleKeyDown = (e) => {
      if (!projectEditable || !selectedObjectId || connectionMode) return;
      if (shouldIgnoreDeviceShortcut(e, describeKeyTarget(e.target), { dialogOpen })) return;

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
  }, [selectedObjectId, objects, connectionMode, dialogOpen, handleDeleteDevice, handleDuplicateDevice, projectEditable, updateSelectedObject]);

  const handleResetView = () => {
    if (!projectEditable && !shareView) return;
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, room.height * 1.8, -room.width * 1.6);
      controlsRef.current.target.set(0, room.height / 2, 0);
      controlsRef.current.update();
      if (projectEditable) setCameraDirty(true);
    }
  };

  const handleCameraInteractionEnd = useCallback(() => {
    if (projectEditable) setCameraDirty(true);
  }, [projectEditable]);

  useEffect(() => {
    if (!projectLoaded || recoveryDraft || shareView) return undefined;
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
  }, [clearLocalDraft, connections, getCurrentCamera, isDirty, objects, projectLoaded, recoveryDraft, room, shareView, showStatus]);

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
    if (shareView) return;
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
      setHasSavedProject(true);
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
        `确定导入“${file.name}”并替换当前的桌面吗？\n导入后仍需点击“保存项目”才会保存。`
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

  useEffect(() => {
    if (!projectLoaded || shareView || hasSavedProject || objects.length > 0) return;
    if (guideDismissedRef.current || hasSeenGuide(getBrowserStorage())) return;
    setGuideOpen(true);
  }, [hasSavedProject, objects.length, projectLoaded, shareView]);

  const closeGuide = () => {
    guideDismissedRef.current = true;
    markGuideSeen(getBrowserStorage());
    setGuideOpen(false);
    setGuideStep(0);
  };

  const handleStartGuideChoice = (choice) => {
    closeGuide();
    if (choice === 'template' || choice === 'builder') {
      setScrollTemplatesToBuilder(choice === 'builder');
      setShowTemplates(true);
    } else {
      setIsLeftPanelOpen(true);
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
    setScrollTemplatesToBuilder(false);
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
    } catch {
      showStatus({ text: '复制失败：浏览器没有允许使用剪贴板，可以改用“导出备份”', type: 'error' }, 4000);
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
        '确定从剪贴板导入项目并替换当前的桌面吗？\n导入后仍需点击“保存项目”才会保存。'
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
  const devicePickerLabels = useMemo(() => labelObjectsForPicker(objects), [objects]);
  const handleApplyAiProject = (nextProject, label) => {
    if (!projectBaseEditable) return;
    recordHistory();
    setObjects(nextProject.objects);
    setConnections(nextProject.connections);
    setAiPreview(null);
    showStatus({ text: `已应用 AI 建议：${label}`, type: 'success' }, 3000);
  };

  const handlePreviewAiSuggestion = (preview) => {
    closeRecommendations();
    setSelectedObjectId(null);
    setAiPreview(preview);
  };

  // Devices linked to the selection, highlighted while the connections tab is open.
  const sceneRelatedIds = new Set();
  if (isPanelOpen && activeTab === 'connections' && selectedObjectId) {
    connections.forEach(c => {
      if (c.fromObjectId === selectedObjectId) sceneRelatedIds.add(c.toObjectId);
      if (c.toObjectId === selectedObjectId) sceneRelatedIds.add(c.fromObjectId);
    });
  }
  const selectionHint = describeSelectionHint({
    selectedName: selectedObj ? selectedObj.name : null,
    isMobile,
    viewOnly: shareView,
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
    () => buildRecommendations({ room, objects, connections }, { wiringIssues, layoutIssues }),
    [room, objects, connections, wiringIssues, layoutIssues]
  );
  const shoppingList = useMemo(
    () => buildShoppingList(recommendations.purchases),
    [recommendations.purchases]
  );

  const cableShoppingList = useMemo(
    () => buildCableShoppingList(connections, objects),
    [connections, objects],
  );
  const handleCopyCableList = async () => {
    try {
      await navigator.clipboard.writeText(cableShoppingList.text);
      showStatus({ text: '购线清单已复制', type: 'success' }, 3000);
    } catch {
      showStatus({ text: '复制失败：浏览器没有允许使用剪贴板，可以手动选中清单文字复制', type: 'error' }, 4000);
    }
  };
  const handleOpenShareLink = async () => {
    try {
      const link = await encodeShareLink({
        room,
        objects,
        connections,
        camera: getCurrentCamera(),
      }, window.location);
      setShareLink(link);
    } catch {
      showStatus({ text: '当前桌面还不能生成分享链接', type: 'error' }, 4000);
    }
  };
  const handleCopyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink.url);
      showStatus({ text: '分享链接已复制', type: 'success' }, 3000);
    } catch {
      showStatus({ text: '复制失败：浏览器没有允许使用剪贴板，可以手动选中链接文字复制', type: 'error' }, 4000);
    }
  };
  const handleAdoptShare = () => {
    if (!shareView) return;
    const confirmed = window.confirm(
      '确定把这份分享复制到你的项目吗？\n画面上的桌面会换成链接里的内容。浏览器里已经保存的项目不会被改掉，除非你之后自己点“保存项目”。'
    );
    if (!confirmed) return;
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    setShareView(false);
    if (storedLoadFailedRef.current) setProjectLoadFailed(true);
    if (visitorLayoutRef.current !== null) setSavedLayout(visitorLayoutRef.current);
    setSelectedObjectId(null);
    const sameAsSaved = visitorLayoutRef.current !== null
      && visitorLayoutRef.current === serializeLayout(room, objects, connections);
    showStatus({
      text: storedLoadFailedRef.current
        ? '你原来的存档读不出来，这份分享只留在当前页面，没有写入浏览器。'
        : sameAsSaved
          ? '这份分享和你已保存的项目一样。'
          : '已复制到当前项目，尚未保存。你原来的存档还在，要点“保存项目”才会替换。',
      type: 'success',
    }, 5000);
  };
  const handleCopyShoppingList = async () => {
    try {
      await navigator.clipboard.writeText(shoppingList.text);
      showStatus({ text: '购物清单已复制', type: 'success' }, 3000);
    } catch {
      showStatus({ text: '复制失败：浏览器没有允许使用剪贴板，可以手动选中清单文字复制', type: 'error' }, 4000);
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
    const menuWidth = 168;
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

  // 工具栏里的每个控件只定义一次，桌面和手机各自排布（E10、E8）。
  const roomFields = (
    <div className="toolbar-cluster toolbar-room" id="toolbar-room">
      <label htmlFor="room-length" className="toolbar-field-label">长:</label>
      <input id="room-length" type="number" min="0.1" step="0.1" className="ui-input toolbar-room-input" value={inputRoom.length} onChange={e => setInputRoom({ ...inputRoom, length: Number(e.target.value) })} disabled={!projectEditable} />
      <label htmlFor="room-width" className="toolbar-field-label">宽:</label>
      <input id="room-width" type="number" min="0.1" step="0.1" className="ui-input toolbar-room-input" value={inputRoom.width} onChange={e => setInputRoom({ ...inputRoom, width: Number(e.target.value) })} disabled={!projectEditable} />
      <label htmlFor="room-height" className="toolbar-field-label">高:</label>
      <input id="room-height" type="number" min="0.1" step="0.1" className="ui-input toolbar-room-input" value={inputRoom.height} onChange={e => setInputRoom({ ...inputRoom, height: Number(e.target.value) })} disabled={!projectEditable} />
      <button className="ui-button" onClick={handleUpdateRoom} disabled={!projectEditable}>更新房间</button>
    </div>
  );
  const titleLabel = <span className="toolbar-label">DeskLab</span>;
  const templatesButton = <button className="ui-button" onClick={() => { setScrollTemplatesToBuilder(false); setShowTemplates(true); }} disabled={!projectEditable}>桌面模板</button>;
  const undoButton = <button className="ui-button" onClick={handleUndo} disabled={!projectEditable || !historyStatus.canUndo} title="撤销 (Ctrl+Z)">撤销</button>;
  const redoButton = <button className="ui-button" onClick={handleRedo} disabled={!projectEditable || !historyStatus.canRedo} title="重做 (Ctrl+Y)">重做</button>;
  const resetViewButton = <button className="ui-button" onClick={handleResetView} disabled={!projectEditable && !shareView}>重置视角</button>;
  const connectionsButton = <button className="ui-button" onClick={() => setShowGlobalConnections(true)}>所有连接</button>;
  const layoutButton = (
    <button className={`ui-button${actionableLayoutIssueCount > 0 ? ' ui-button-tag' : ''}`} onClick={() => setShowLayoutReport(true)} aria-label={countLabel('布局检查', actionableLayoutIssueCount)}>
      布局检查<CountBadge count={actionableLayoutIssueCount} />
    </button>
  );
  const wiringButton = (
    <button className={`ui-button${actionableWiringIssueCount > 0 ? ' ui-button-tag' : ''}`} onClick={() => setShowWiringReport(true)} aria-label={countLabel('布线检查', actionableWiringIssueCount)}>
      布线检查<CountBadge count={actionableWiringIssueCount} />
    </button>
  );
  const recommendButton = (
    <button className="ui-button ui-button-tag" onClick={() => setShowRecommendations(true)} aria-label={countLabel('改进建议', recommendations.total)}>
      改进建议<CountBadge count={recommendations.total} />
    </button>
  );
  const moreButton = (
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
  );
  const moreMenu = moreMenuPosition && (
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
      <div className="toolbar-menu-separator" role="separator" />
      <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(() => setShowCableShop(true))}>购线清单</button>
      <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(handleOpenShareLink)} disabled={!projectLoaded || projectLoadFailed}>复制分享链接</button>
      <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(() => { setGuideStep(0); setGuideOpen(true); })}>新手引导</button>
      <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(() => setShowAbout(true))}>关于与隐私</button>
    </div>
  );
  const importInput = (
    <input
      ref={importInputRef}
      type="file"
      accept="application/json,.json"
      onChange={handleImportProject}
      style={{ display: 'none' }}
      aria-label="导入 DeskLab 备份文件"
    />
  );
  const leftPanelButton = (
    <button className="ui-button" onClick={handleToggleLeftPanel}>
      {isLeftPanelOpen ? '收起资产库' : '展开资产库'}
    </button>
  );
  const rightPanelButton = (
    <button className="ui-button" onClick={handleToggleRightPanel}>
      {isPanelOpen ? '收起属性面板' : '展开属性面板'}
    </button>
  );
  const unsavedIndicator = isDirty && <span className="unsaved-indicator" role="status">未保存</span>;
  const saveButton = (
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
  );
  const appToolbar = (
    <AppToolbar
      isMobile={isMobile}
      isRoomEditorOpen={isRoomEditorOpen}
      onToggleRoom={() => setIsRoomEditorOpen(open => !open)}
      titleLabel={titleLabel}
      roomFields={roomFields}
      templatesButton={templatesButton}
      undoButton={undoButton}
      redoButton={redoButton}
      resetViewButton={resetViewButton}
      connectionsButton={connectionsButton}
      layoutButton={layoutButton}
      wiringButton={wiringButton}
      recommendButton={recommendButton}
      moreButton={moreButton}
      leftPanelButton={leftPanelButton}
      rightPanelButton={rightPanelButton}
      unsavedIndicator={unsavedIndicator}
      saveButton={saveButton}
      moreMenu={moreMenu}
      importInput={importInput}
    />
  );

  const movePanelTab = (event, current) => {
    const order = ['properties', 'connections'];
    const index = order.indexOf(current);
    let next;
    if (event.key === 'ArrowRight') next = order[(index + 1) % order.length];
    else if (event.key === 'ArrowLeft') next = order[(index - 1 + order.length) % order.length];
    else if (event.key === 'Home') next = order[0];
    else if (event.key === 'End') next = order[order.length - 1];
    else return;
    event.preventDefault();
    event.stopPropagation();
    setActiveTab(next);
    document.getElementById(next === 'properties' ? 'panel-tab-properties' : 'panel-tab-connections')?.focus();
  };

  return (
    <div className="app-shell">
      {/* 顶部控制栏 */}
      <div className="app-top">
        {appToolbar}

        {shareView && (
          <ShareViewBanner onCopyIn={handleAdoptShare} />
        )}

        {recoveryDraft && !shareView && (
          <DraftRecoveryBanner
            savedAt={recoveryDraft.savedAt}
            onRestore={handleRestoreDraft}
            onExport={handleExportRecoveryDraft}
            onDiscard={handleDiscardDraft}
          />
        )}

        {showBackupReminder && !recoveryDraft && !projectLoadFailed && (
          <BackupReminderBanner onExport={handleExportProject} onSnooze={handleSnoozeBackupReminder} />
        )}

        <ErrorNotice />

        {aiPreview && (
          <AiPreviewBanner
            title={aiPreview.title}
            onApply={() => handleApplyAiProject(aiPreview.nextProject, aiPreview.title)}
            onCancel={() => setAiPreview(null)}
          />
        )}

        {projectLoadFailed && (
          <CorruptSaveBanner busy={backupRecoveryBusy} onRecover={handleRecoverBackup} />
        )}

        <SelectionHint
          active={Boolean(selectedObj)}
          titleKey={selectedObj?.id ?? 'none'}
          title={selectionHint.title}
          tip={selectionHint.tip}
        />
        {selectedObj && projectEditable && !connectionMode && !aiPreview && (
          <div className="gizmo-mode" role="group" aria-label="控制柄">
            <button
              type="button"
              className="ui-button"
              aria-pressed={activeGizmoMode === 'translate'}
              disabled={gizmoDragging}
              onClick={() => chooseGizmoMode('translate')}
            >
              移动
            </button>
            <button
              type="button"
              className="ui-button"
              aria-pressed={activeGizmoMode === 'rotate'}
              disabled={gizmoDragging}
              onClick={() => chooseGizmoMode('rotate')}
            >
              旋转
            </button>
          </div>
        )}
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
        
        {connectionMode && <ConnectionModeBanner />}

        {isLeftPanelOpen && (
          <div className="left-panel">
            <div className="left-panel-header">
              <div className="left-panel-title">资产库</div>
              <button onClick={() => setIsLeftPanelOpen(false)} className="side-panel-close" aria-label="关闭资产库" title="关闭"><CloseIcon /></button>
            </div>
            <LibraryBrowser disabled={!projectEditable} onAdd={handleAddDevice} />
          </div>
        )}

        {/* 左侧/中间：3D 视图 */}
        <div ref={canvasContainerRef} style={{ flex: 1, position: 'relative', cursor: dragInfo ? 'grabbing' : 'default', minWidth: 0, minHeight: 0 }}>
          {!webglAvailable ? <SceneUnavailable reason="no-webgl" /> : (
          <SceneErrorBoundary>
          {reportSceneFailure => (
          <LazyScene3D
            reportFailure={reportSceneFailure}
            cameraConfig={cameraConfig}
            room={room}
            controlsRef={controlsRef}
            cameraRef={cameraRef}
            controlsEnabled={cameraZoomEnabled({
              editable: projectEditable,
              viewOnly: shareView,
              connectionMode,
              dragging: Boolean(dragInfo),
              gizmoDragging,
            })}
            onCameraInteractionEnd={handleCameraInteractionEnd}
            dragPlaneY={dragInfo ? dragInfo.planeY : null}
            onDragMove={point => {
              const obj = objects.find(o => o.id === dragInfo?.objId);
              if (!obj) return;
              updateSelectedObject(
                { position: { x: point.x + dragInfo.offsetX, y: point.z + dragInfo.offsetY } },
                { groupKey: `drag:${obj.id}`, holdGroup: true },
              );
            }}
            onDragEnd={endObjectDrag}
            showAxes={showAxes}
            objects={aiPreview ? aiPreview.nextProject.objects : objects}
            connections={aiPreview ? aiPreview.nextProject.connections : connections}
            selectedObjectId={selectedObjectId}
            relatedIds={aiPreview ? new Set(aiPreview.changedIds) : sceneRelatedIds}
            hoveredObjectId={connectionMode ? hoveredDeviceId : null}
            onBackgroundClick={() => {
              if (!connectionMode) setSelectedObjectId(null);
            }}
            onObjectClick={obj => {
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
            onObjectPointerDown={(obj, point) => {
              if (!canStartObjectDrag({ projectEditable, connectionMode })) return;
              finishHistoryGroup();
              setSelectedObjectId(obj.id);
              setDragInfo({ objId: obj.id, planeY: point.y, offsetX: obj.position.x - point.x, offsetY: obj.position.y - point.z, startPosition: obj.position });
            }}
            onObjectHover={obj => {
              if (projectEditable && connectionMode) setHoveredDeviceId(obj.id);
            }}
            onObjectHoverEnd={obj => {
              if (projectEditable && connectionMode && hoveredDeviceId === obj.id) setHoveredDeviceId(null);
            }}
            gizmoEnabled={Boolean(selectedObj) && projectEditable && !connectionMode && !aiPreview && !dragInfo}
            gizmoMode={activeGizmoMode}
            gizmoSize={isMobile ? 1.25 : 0.8}
            onGizmoChange={handleGizmoChange}
            onGizmoDragStart={handleGizmoDragStart}
            onGizmoDragEnd={handleGizmoDragEnd}
          />
          )}
          </SceneErrorBoundary>
          )}
        </div>

        {/* 右侧：面板 */}
        {isPanelOpen && (
          <div className="side-panel">
            <div className="side-panel-tabs" role="tablist" aria-label="属性面板">
              <button
                type="button"
                role="tab"
                id="panel-tab-properties"
                aria-controls="panel-tabpanel"
                aria-selected={activeTab === 'properties'}
                tabIndex={activeTab === 'properties' ? 0 : -1}
                className={`side-panel-tab ${activeTab === 'properties' ? 'side-panel-tab-active' : ''}`}
                onClick={() => setActiveTab('properties')}
                onKeyDown={event => movePanelTab(event, 'properties')}
              >
                属性
              </button>
              <button
                type="button"
                role="tab"
                id="panel-tab-connections"
                aria-controls="panel-tabpanel"
                aria-selected={activeTab === 'connections'}
                tabIndex={activeTab === 'connections' ? 0 : -1}
                className={`side-panel-tab ${activeTab === 'connections' ? 'side-panel-tab-active' : ''}`}
                onClick={() => setActiveTab('connections')}
                onKeyDown={event => movePanelTab(event, 'connections')}
              >
                连接
              </button>
              <button onClick={() => setIsPanelOpen(false)} className="side-panel-close" aria-label="关闭面板" title="关闭面板"><CloseIcon /></button>
            </div>

            {/* Picking a device here works without the 3D view: for the keyboard,
                and for small things under or behind others. */}
            <div className="panel-field side-panel-picker">
              <label className="panel-field-label" htmlFor="panel-device-picker">设备</label>
              <div className="panel-field-content">
                <select
                  id="panel-device-picker"
                  className="ui-select ui-full-width"
                  value={selectedObj ? selectedObj.id : ''}
                  onChange={event => setSelectedObjectId(event.target.value || null)}
                >
                  <option value="">-- 选择设备 --</option>
                  {objects.map(object => (
                    <option key={object.id} value={object.id}>{devicePickerLabels.get(object.id)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className="side-panel-content"
              role="tabpanel"
              id="panel-tabpanel"
              aria-labelledby={activeTab === 'properties' ? 'panel-tab-properties' : 'panel-tab-connections'}
            >
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
                    在 3D 画面里点选一个设备，<br />或从上面的列表里选，<br />就可以在这里编辑它。
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

      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}

      {showTemplates && (
        <TemplateDialog
          hasObjects={objects.length > 0}
          editable={projectEditable}
          scrollToBuilder={scrollTemplatesToBuilder}
          onClose={() => {
            setScrollTemplatesToBuilder(false);
            setShowTemplates(false);
          }}
          onApplyTemplate={handleApplyTemplate}
          onGenerate={scene => applyGeneratedScene(scene, '已按你的设备生成桌面')}
        />
      )}

      {showLayoutReport && (
        <LayoutReportDialog
          summary={layoutSummary}
          issues={layoutIssues}
          autoFixableCount={layoutAutoFixableCount}
          editable={projectEditable}
          onClose={() => setShowLayoutReport(false)}
          onAutoFix={() => handleApplyAutoFixes(layoutAutoFixCodes)}
          onDropToSupport={handleDropObjectToSupport}
          onMoveInsideRoom={handleMoveObjectInsideRoom}
          onSnapOutletToWall={handleSnapOutletToWall}
          onLocate={(objectId) => {
            setSelectedObjectId(objectId);
            setActiveTab('properties');
            setIsPanelOpen(true);
            if (isMobile) setIsLeftPanelOpen(false);
            setShowLayoutReport(false);
          }}
        />
      )}

      {showWiringReport && (
        <WiringReportDialog
          summary={wiringSummary}
          issues={wiringIssues}
          invalidConnectionCount={invalidConnectionCount}
          cableAutoFixableCount={cableAutoFixableCount}
          editable={projectEditable}
          onClose={() => setShowWiringReport(false)}
          onCleanupInvalid={handleCleanupInvalidConnections}
          onExtendShortCables={() => handleApplyAutoFixes(['extend_cable'])}
          onExtendCable={handleExtendCableToRecommended}
          onAddPowerStrip={() => { handleAddRecommendedPowerStrip(); setShowWiringReport(false); }}
          onLocate={(issue) => {
            setSelectedObjectId(issue.objectIds[0]);
            setActiveTab(issue.connectionIds.length > 0 ? 'connections' : 'properties');
            setIsPanelOpen(true);
            if (isMobile) setIsLeftPanelOpen(false);
            setShowWiringReport(false);
          }}
          onShowConnections={() => {
            setShowWiringReport(false);
            setShowGlobalConnections(true);
          }}
        />
      )}

      {showGlobalConnections && (
        <ConnectionsListDialog
          connections={connections}
          objects={objects}
          onClose={() => setShowGlobalConnections(false)}
          onDelete={(connectionId) => updateConnectionsWithHistory(prev => prev.filter(connection => connection.id !== connectionId))}
          onOpenCableShop={() => {
            setShowGlobalConnections(false);
            setShowCableShop(true);
          }}
        />
      )}

      {showCableShop && (
        <CableShoppingDialog
          items={cableShoppingList.items}
          onCopy={handleCopyCableList}
          onClose={() => setShowCableShop(false)}
        />
      )}

      {shareLink && (
        <ShareLinkDialog
          url={shareLink.url}
          tooLong={shareLink.tooLong}
          onCopy={handleCopyShareLink}
          onClose={() => setShareLink(null)}
        />
      )}

      {guideOpen && (
        <OnboardingGuide
          stepIndex={guideStep}
          canEdit={projectEditable}
          onStep={setGuideStep}
          onClose={closeGuide}
          onStart={handleStartGuideChoice}
        />
      )}

      {showRecommendations && (
        <RecommendationsDialog
          editable={projectEditable}
          hasObjects={objects.length > 0}
          recommendations={recommendations}
          shoppingList={shoppingList}
          layoutIssueCount={actionableLayoutIssueCount}
          wiringIssueCount={actionableWiringIssueCount}
          purchaseGuidance={purchaseGuidance}
          ai={aiAssistant}
          project={currentProject}
          onClose={closeRecommendations}
          onApplyAi={(nextProject, label) => {
            handleApplyAiProject(nextProject, label);
            closeRecommendations();
          }}
          onPreviewAi={handlePreviewAiSuggestion}
          onApplyAllFree={() => {
            if (!projectEditable) return;
            const next = applyAllAvailableImprovements({ room, objects, connections });
            recordHistory();
            setObjects(next.objects);
            setConnections(next.connections);
            showStatus({ text: '已自动应用所有可用免费改进', type: 'success' });
          }}
          onOpenLayout={() => {
            closeRecommendations();
            setShowLayoutReport(true);
          }}
          onOpenWiring={() => {
            closeRecommendations();
            setShowWiringReport(true);
          }}
          onStartPurchase={handleStartPurchaseWiring}
          onOpenTemplates={() => {
            closeRecommendations();
            setScrollTemplatesToBuilder(false);
            setShowTemplates(true);
          }}
          onOpenLibrary={() => {
            closeRecommendations();
            setIsLeftPanelOpen(true);
            if (isMobile) setIsPanelOpen(false);
          }}
          onDropToSupport={handleDropObjectToSupport}
          onMoveInsideRoom={handleMoveObjectInsideRoom}
          onSnapOutletToWall={handleSnapOutletToWall}
          onExtendCable={handleExtendCableToRecommended}
          onAutoConnectNetwork={handleAutoConnectNetwork}
          onAutoConnectDisplay={handleAutoConnectDisplay}
          onAddPowerStrip={handleAddRecommendedPowerStrip}
          onCopyShoppingList={handleCopyShoppingList}
          onLocate={(objectId) => {
            setSelectedObjectId(objectId);
            setActiveTab('properties');
            setIsPanelOpen(true);
            if (isMobile) setIsLeftPanelOpen(false);
            closeRecommendations();
          }}
        />
      )}

      <StatusToast text={statusMsg.text} type={statusMsg.type} />
    </div>
  );
};
