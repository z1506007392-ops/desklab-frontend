import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { UNSAVED_PROJECT_VERSION, createLocalProjectClient } from './domain/local-project-store.js';
import {
  analyzeProjectWiring,
  getInvalidConnectionIds,
  summarizeWiringIssues,
} from './domain/analysis.js';
import { safeClamp, validateAndConstrainObject } from './domain/geometry.js';
import {
  analyzeProjectLayout,
  settleAfterDrag,
  pushOntoSupport,
  snapObjectToSupport,
  snapWallOutletToNearestWall,
  summarizeLayoutIssues,
} from './domain/layout-analysis.js';
import {
  createProjectDraft,
  isDraftDifferent,
} from './domain/draft.js';
import { PROJECT_DRAFT_STORAGE_KEY, createProjectDraftStorage } from './domain/draft-storage.js';
import './App.css';
import {
  findModelTemplate,
  hydrateProjectObjects,
} from './domain/catalog.js';
import LibraryBrowser from './components/LibraryBrowser.jsx';
import { applyCameraPose, captureCameraSnapshot, defaultCameraPose } from './domain/camera-snapshot.js';
import { hidesAnotherScreen, lineUpScreens, placeCatalogObject, placeCopy } from './domain/placement.js';
import { lengthenCablesFor } from './domain/connections.js';
import { findRiders, removeAndDropRiders, updateWithRiders } from './domain/riders.js';
import { refitLayoutToRoom } from './domain/room-resize.js';
import { applyLayoutTip, buildLayoutTips } from './domain/layout-tips.js';
import { createEntityId } from './domain/identifiers.js';
import { describeKeyTarget, getObjectKeyboardUpdate, shouldIgnoreDeviceShortcut } from './domain/keyboard-controls.js';
import { menuClosesOnKey, nextMenuIndex } from './domain/menu-keyboard.js';
import { e2eDanglingConnection, shellCrashRequested } from './domain/error-report.js';
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
import { screenUntrustedProject } from './domain/untrusted-project.js';
import { getPurchaseGuidance } from './domain/purchase-guidance.js';
import { buildTemplateScene } from './domain/desk-templates.js';
import { buildShoppingList } from './domain/shopping-list.js';
import { buildCableShoppingList } from './domain/cable-shopping-list.js';
import { buildCableRunSheet } from './domain/cable-run-sheet.js';
import {
  addLayoutScheme,
  layoutSchemesDocument,
  layoutSchemesInBackup,
  loadLayoutSchemes,
  removeLayoutScheme,
  storeLayoutSchemes,
} from './domain/layout-schemes.js';
import { labelObjectsForPicker } from './domain/object-labels.js';
import { hasSeenGuide, markGuideSeen } from './domain/onboarding.js';
import { PHONE_MEDIA_QUERY, dismissPhoneNotice, hasDismissedPhoneNotice } from './domain/phone-notice.js';
import { SHARE_LINK_MESSAGES, decodeShareLink, encodeShareLink } from './domain/share-link.js';
import { openGalleryFromHash } from './domain/community-gallery.js';
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
import LayoutSchemesDialog from './components/LayoutSchemesDialog.jsx';
import ShareLinkDialog from './components/ShareLinkDialog.jsx';
import ShareViewBanner from './components/ShareViewBanner.jsx';
import CommunityGalleryDialog from './components/CommunityGalleryDialog.jsx';
import GalleryViewBanner from './components/GalleryViewBanner.jsx';
import OnboardingGuide from './components/OnboardingGuide.jsx';
import ErrorNotice from './components/ErrorNotice.jsx';
import DraftRecoveryBanner from './components/DraftRecoveryBanner.jsx';
import BackupReminderBanner from './components/BackupReminderBanner.jsx';
import PhoneNoticeBanner from './components/PhoneNoticeBanner.jsx';
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
import EntryDeskStep from './components/EntryDeskStep.jsx';
import EntryRoomPage from './components/EntryRoomPage.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import { getAppStorage, isFileArchiveActive } from './domain/app-storage.js';
import { ENTRY_PRESET_TEMPLATE_ID, formatEntryRoom, placePresetInRoom, shouldShowEntry } from './domain/entry-flow.js';

const getBrowserStorage = () => getAppStorage();
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

function replacePageHash(hash) {
  const url = new URL(window.location.href);
  url.hash = hash || '';
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

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
  if (shellCrashRequested()) {
    throw new Error('页面外壳在渲染时出错');
  }
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
  // A gallery desk is also only on screen. Returning restores what was here.
  const [galleryView, setGalleryView] = useState(false);
  const [galleryTitle, setGalleryTitle] = useState('');
  const readOnlyView = shareView || galleryView;
  const projectEditable = projectBaseEditable && !aiPreview && !readOnlyView;
  
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const importInputRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const projectVersionRef = useRef(null);
  const visitorLayoutRef = useRef(null);
  const galleryReturnRef = useRef(null);
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
  // A phone (small touch screen) is told once that a computer works better (E59).
  const [onPhone, setOnPhone] = useState(() => window.matchMedia?.(PHONE_MEDIA_QUERY).matches ?? false);
  const [phoneNoticeDismissed, setPhoneNoticeDismissed] = useState(() => hasDismissedPhoneNotice(getBrowserStorage()));
  const [showSettings, setShowSettings] = useState(false);
  // Returning to the room page from 设置. The first visit must not be cancelled
  // by the same effect that skips entry for someone who already finished it.
  const [roomRepick, setRoomRepick] = useState(false);
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
  const [showGallery, setShowGallery] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showLayoutSchemes, setShowLayoutSchemes] = useState(false);
  const [layoutSchemes, setLayoutSchemes] = useState(() => loadLayoutSchemes(getBrowserStorage()));
  const [webglAvailable] = useState(() => canUseWebGL());
  // First-visit guide: only for a project that has never been saved, until
  // the user picks a way to start or something appears in the room.
  const [hasSavedProject, setHasSavedProject] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [entryStep, setEntryStep] = useState('pending');
  const fileArchive = isFileArchiveActive();
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

  useEffect(() => {
    storeLayoutSchemes(getBrowserStorage(), layoutSchemes);
  }, [layoutSchemes]);

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

  const clearLocalDraft = useCallback(async () => {
    const result = await Promise.resolve(projectDraftStorage.clear());
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
    const mql = window.matchMedia?.(PHONE_MEDIA_QUERY);
    if (!mql) return undefined;
    const onChange = event => setOnPhone(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

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
    // What stands on it goes along: a moved or turned desk keeps its screens.
    setObjects(prev => updateWithRiders(prev, constrainedObj, room));
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
      if (settled) setObjects(current => updateWithRiders(current, settled, latest.room));
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
      let loaded = null;
      if (stored.ok) {
        const data = stored.result.project;
        const loadedRoom = data.room || { length: 10, width: 10, height: 3 };
        const hydratedObjects = hydrateProjectObjects(data.objects || []);
        const loadedConnections = data.connections || [];
        projectVersionRef.current = stored.result.version;
        setHasSavedProject(stored.result.version !== UNSAVED_PROJECT_VERSION);
        storedLoadFailedRef.current = false;
        visitorLayoutRef.current = serializeLayout(loadedRoom, hydratedObjects, loadedConnections);
        loaded = {
          room: loadedRoom,
          objects: hydratedObjects,
          connections: loadedConnections,
          camera: data.camera || null,
        };
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

      // A built-in gallery desk is also only on screen. A desk saved in this
      // browser is not opened from the address.
      const gallery = openGalleryFromHash(hash);
      if (gallery.kind === 'ok') {
        if (loaded) {
          const extraConnection = e2eDanglingConnection();
          galleryReturnRef.current = {
            room: loaded.room,
            objects: loaded.objects,
            connections: extraConnection ? [...loaded.connections, extraConnection] : loaded.connections,
            camera: loaded.camera,
            savedLayout: visitorLayoutRef.current,
            cameraDirty: false,
          };
        } else {
          galleryReturnRef.current = null;
        }
        const project = gallery.desk.project;
        const nextObjects = hydrateProjectObjects(project.objects || []);
        const nextConnections = project.connections || [];
        setProjectLoadFailed(false);
        setRoom(project.room);
        setInputRoom(project.room);
        setObjects(nextObjects);
        setConnections(nextConnections);
        setCameraConfig(project.camera || null);
        setSavedLayout(serializeLayout(project.room, nextObjects, nextConnections));
        setCameraDirty(false);
        setGalleryTitle(gallery.desk.title);
        setGalleryView(true);
        setProjectLoaded(true);
        resetHistory();
        return;
      }

      const shareNotice = shared.kind === 'absent' ? '' : SHARE_LINK_MESSAGES[shared.kind];
      const galleryNotice = gallery.kind === 'unknown' ? gallery.message : '';
      if (!stored.ok) {
        const err = stored.error;
        console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
        setProjectLoadFailed(true);
        const storedNotice = err.code === 'storage_unavailable'
          ? err.message
          : '本机保存的项目无法读取，已锁定保存以保护原数据。可以尝试恢复上一版本。';
        const notice = [shareNotice, galleryNotice, storedNotice].filter(Boolean).join(' ');
        showStatus({ text: notice, type: 'error' });
        const localDraft = readLocalDraft();
        if (localDraft) setRecoveryDraft(localDraft);
        setProjectLoaded(true);
        return;
      }

      const openNotice = [shareNotice, galleryNotice].filter(Boolean).join(' ');
      if (openNotice) showStatus({ text: openNotice, type: 'error' }, 6000);
      const data = stored.result.project;
      const loadedRoom = data.room || { length: 10, width: 10, height: 3 };
      const hydratedObjects = hydrateProjectObjects(data.objects || []);
      const storedConnections = data.connections || [];
      const extraConnection = e2eDanglingConnection();
      const loadedConnections = extraConnection ? [...storedConnections, extraConnection] : storedConnections;
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
      if (settled) setObjects(current => updateWithRiders(current, settled, latest.room));
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
        if (showSettings) {
          setShowSettings(false);
        }
        if (roomRepick && entryStep === 'room') {
          setRoomRepick(false);
          setEntryStep('done');
        }
        if (showLayoutSchemes) {
          setShowLayoutSchemes(false);
        }
        if (showTemplates) {
          setScrollTemplatesToBuilder(false);
          setShowTemplates(false);
        }
        if (showGallery) {
          setShowGallery(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDownEsc);
    return () => window.removeEventListener('keydown', handleKeyDownEsc);
  }, [closeRecommendations, connectionMode, entryStep, roomRepick, shareLink, showAbout, showCableShop, showGallery, showGlobalConnections, showLayoutSchemes, showWiringReport, showLayoutReport, showRecommendations, showSettings, showTemplates]);

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
    // What stands on it falls to what is below once it is gone (E53).
    const riderCount = findRiders(obj, objects).length;

    const riderLine = riderCount === 0
      ? ''
      : obj.modelId === 'office-desk'
        ? `跟着这张桌子的 ${riderCount} 件设备会落到下面。`
        : `上面放着的 ${riderCount} 件设备会落到下面。`;
    const confirmMessage = [
      `确定要删除设备“${obj.name}”吗？`,
      riderLine,
      relatedConnections.length > 0 ? `删除该设备将同时删除 ${relatedConnections.length} 条关联连接。` : '',
    ].filter(Boolean).join('\n');

    if (window.confirm(confirmMessage)) {
      recordHistory();
      setObjects(prev => removeAndDropRiders(prev, selectedObjectId, room).objects);
      if (relatedConnections.length > 0) {
        setConnections(prev => prev.filter(c => c.fromObjectId !== selectedObjectId && c.toObjectId !== selectedObjectId));
      }
      setSelectedObjectId(null);
      setConnectionMode(false);
      setConnectionDraft({});
      setHoveredDeviceId(null);
      showStatus({ text: '删除成功', type: 'success' }, 3000);
    }
  }, [selectedObjectId, connectionMode, objects, connections, projectEditable, recordHistory, room, showStatus]);

  // A device just placed joins the project. A new screen that would hide
  // another is lined up with the desk's screens when they all fit side by
  // side (placement.js), and their cables are lengthened where the move made
  // them short; then the device gets its power, video and network lines.
  const settleNewDevice = useCallback((placedDevice) => {
    let device = placedDevice;
    let nextObjects = [...objects, device];
    let nextConnections = connections;
    if (hidesAnotherScreen(device, objects)) {
      const row = lineUpScreens(device, room, objects);
      if (row) {
        const moved = new Map(row.moved.map(entry => [entry.id, entry.position]));
        device = row.screen;
        nextObjects = [...objects.map(object => (moved.has(object.id) ? { ...object, position: moved.get(object.id) } : object)), device];
        nextConnections = lengthenCablesFor(connections, nextObjects, new Set(moved.keys()));
      }
    }
    const newLines = buildConnectionCompletion({ room, objects: nextObjects, connections: nextConnections }, device.id);
    return {
      device,
      objects: nextObjects,
      connections: newLines.length > 0 ? [...nextConnections, ...newLines] : nextConnections,
    };
  }, [connections, objects, room]);

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

    // 4. 放在原设备旁边、同一个面上、不和别的重叠（placement.js 的 placeCopy），
    //    再像新加的设备一样补上电源、显示和网络线。
    const placed = placeCopy(obj, clonedObj, room, objects);
    if (!placed) {
      showStatus({ text: '复制失败：附近没有空位', type: 'error' }, 3000);
      return;
    }
    recordHistory();
    const settled = settleNewDevice(placed);
    setObjects(settled.objects);
    if (settled.connections !== connections) setConnections(settled.connections);
    setSelectedObjectId(settled.device.id);
    showStatus({ text: '复制成功', type: 'success' }, 3000);
  }, [selectedObjectId, connectionMode, objects, connections, projectEditable, room, recordHistory, settleNewDevice, showStatus]);

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

  const entryOpen = entryStep === 'room' || entryStep === 'desk';
  const dialogOpen = showTemplates || showGallery || showLayoutReport || showWiringReport || showGlobalConnections || showCableShop || shareLink || showRecommendations || showAbout || showSettings || showLayoutSchemes || guideOpen || entryOpen;

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
      // Arrows slide it the way a drag does, so keyboard users get the same
      // landing: off the desk it drops, inside a desk it stands on top (E52).
      // Space still lifts and lowers it as asked.
      if (e.key.startsWith('Arrow')) {
        const moved = validateAndConstrainObject({ ...obj, position: update.position }, room);
        const settled = moved.valid
          && settleAfterDrag(room, moved.object, objects.map(item => (item.id === obj.id ? moved.object : item)), obj.position);
        if (settled) {
          updateSelectedObject({ position: settled.position });
          return;
        }
      }
      updateSelectedObject(update);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, objects, room, connectionMode, dialogOpen, handleDeleteDevice, handleDuplicateDevice, projectEditable, updateSelectedObject]);

  const handleDismissPhoneNotice = () => {
    dismissPhoneNotice(getBrowserStorage());
    setPhoneNoticeDismissed(true);
  };

  const handleCopyPageLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showStatus({ text: '网址已复制，可以发到电脑上打开', type: 'success' }, 3000);
      handleDismissPhoneNotice();
    } catch {
      showStatus({ text: '复制失败，请长按地址栏里的网址复制', type: 'error' }, 4000);
    }
  };

  const handleResetView = () => {
    if (!projectEditable && !shareView && !galleryView) return;
    if (cameraRef.current && controlsRef.current) {
      // From behind the seat of the first desk, however it is turned (E54).
      applyCameraPose(cameraRef.current, controlsRef.current, defaultCameraPose(room, objects));
      if (projectEditable) setCameraDirty(true);
    }
  };

  const handleCameraInteractionEnd = useCallback(() => {
    if (projectEditable) setCameraDirty(true);
  }, [projectEditable]);

  useEffect(() => {
    if (!projectLoaded || recoveryDraft || shareView || galleryView) return undefined;
    if (!isDirty) {
      clearLocalDraft();
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      const draft = createProjectDraft({
        room,
        objects,
        connections,
        camera: getCurrentCamera(),
      });
      const result = await Promise.resolve(projectDraftStorage.write(draft));
      if (!result.ok) {
        console.warn('Unable to save local project draft.', result.error);
        showStatus({
          text: '本地草稿保存失败；请立即保存项目或导出备份。',
          type: 'error',
        });
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [clearLocalDraft, connections, galleryView, getCurrentCamera, isDirty, objects, projectLoaded, recoveryDraft, room, shareView, showStatus]);

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
    if (shareView || galleryView) return;
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
      const draftCleared = !fullyCurrent || await clearLocalDraft();
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
      layoutSchemes: layoutSchemesDocument(layoutSchemes),
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
      const result = screenUntrustedProject(await projectClient.validate(parsed));

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
      const incomingSchemes = layoutSchemesInBackup(parsed);
      if (incomingSchemes) setLayoutSchemes(incomingSchemes);
      showStatus({ text: '备份已导入，尚未保存', type: 'success' }, 3000);
    } catch (error) {
      showStatus({ text: `导入失败：${describeProjectImportError(error)}`, type: 'error' }, 5000);
    } finally {
      input.value = '';
    }
  };

  const finishEntry = useCallback(() => {
    guideDismissedRef.current = true;
    markGuideSeen(getBrowserStorage());
    setEntryStep('done');
  }, []);

  useEffect(() => {
    if (!projectLoaded || roomRepick) return;
    const guideSeen = guideDismissedRef.current || hasSeenGuide(getBrowserStorage());
    if (!shouldShowEntry({
      shareView,
      galleryView,
      hasSavedProject,
      objectCount: objects.length,
      guideSeen,
      recoveringDraft: Boolean(recoveryDraft),
    })) {
      if (objects.length > 0 && !hasSavedProject && !shareView && !galleryView && !guideSeen) finishEntry();
      else setEntryStep('done');
      return;
    }
    setEntryStep(current => (current === 'desk' ? 'desk' : 'room'));
  }, [finishEntry, galleryView, hasSavedProject, objects.length, projectLoaded, recoveryDraft, roomRepick, shareView]);

  const handleConfirmEntryRoom = roomSize => {
    if (roomRepick) {
      if (!projectEditable) return;
      const result = refitLayoutToRoom(room, roomSize, objects);
      if (!result.valid) {
        showStatus({ text: result.reason || '这间房放不下现在的摆法', type: 'error' }, 4000);
        return;
      }
      const unchanged = JSON.stringify(room) === JSON.stringify(result.room)
        && JSON.stringify(objects) === JSON.stringify(result.objects);
      if (!unchanged) {
        recordHistory();
        setRoom(result.room);
        setInputRoom(result.room);
        setObjects(result.objects);
        showStatus({ text: '房间尺寸已更新', type: 'success' }, 3000);
      }
      setRoomRepick(false);
      setEntryStep('done');
      return;
    }
    setRoom(roomSize);
    setInputRoom(roomSize);
    setCameraConfig(defaultCameraPose(roomSize, []));
    setEntryStep('desk');
  };

  const handleEntryPreset = () => {
    if (!projectEditable) return;
    const placed = placePresetInRoom(ENTRY_PRESET_TEMPLATE_ID, room);
    if (!placed.ok) {
      showStatus({ text: placed.reason || '这间房放不下这张电竞桌', type: 'error' }, 4000);
      return;
    }
    if (savedLayout === null) {
      setSavedLayout(serializeLayout(room, objects, connections));
    }
    recordHistory(null, {
      includeCamera: true,
      camera: getCurrentCamera(),
      cameraDirty,
    });
    setRoom(placed.room);
    setInputRoom(placed.room);
    setObjects(placed.objects);
    setConnections(placed.connections);
    setCameraConfig(placed.camera);
    setCameraDirty(true);
    setSelectedObjectId(null);
    setConnectionMode(false);
    setConnectionDraft({});
    finishEntry();
    showStatus({ text: '已放上电竞桌', type: 'success' }, 3000);
  };

  const handleEntryCustom = () => {
    finishEntry();
    setIsLeftPanelOpen(true);
  };

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

  const showGalleryDesk = (desk, stash) => {
    galleryReturnRef.current = stash;
    const project = desk.project;
    const nextObjects = hydrateProjectObjects(project.objects || []);
    const nextConnections = project.connections || [];
    setProjectLoadFailed(false);
    setRoom(project.room);
    setInputRoom(project.room);
    setObjects(nextObjects);
    setConnections(nextConnections);
    setCameraConfig(project.camera || null);
    setSavedLayout(serializeLayout(project.room, nextObjects, nextConnections));
    setCameraDirty(false);
    setSelectedObjectId(null);
    setConnectionMode(false);
    setConnectionDraft({});
    setHoveredDeviceId(null);
    setGalleryTitle(desk.title);
    setGalleryView(true);
    setShowGallery(false);
    replacePageHash(desk.builtin ? `desklab-gallery/${desk.id}` : '');
    resetHistory();
  };

  const handleOpenGalleryDesk = (desk) => {
    const stash = galleryView ? galleryReturnRef.current : {
      room,
      objects,
      connections,
      camera: getCurrentCamera(),
      savedLayout,
      cameraDirty,
    };
    showGalleryDesk(desk, stash);
  };

  const handleReturnFromGallery = () => {
    if (!galleryView) return;
    const back = galleryReturnRef.current;
    galleryReturnRef.current = null;
    setGalleryView(false);
    setGalleryTitle('');
    replacePageHash('');
    setShowGallery(false);
    if (!back) {
      if (storedLoadFailedRef.current) setProjectLoadFailed(true);
      resetHistory();
      return;
    }
    setRoom(back.room);
    setInputRoom(back.room);
    setObjects(back.objects);
    setConnections(back.connections);
    setCameraConfig(back.camera || null);
    setSavedLayout(back.savedLayout);
    setCameraDirty(Boolean(back.cameraDirty));
    setSelectedObjectId(null);
    setConnectionMode(false);
    setConnectionDraft({});
    resetHistory();
  };

  const adoptGalleryProject = (project, title) => {
    const confirmed = window.confirm(
      `确定把“${title}”复制到你的项目吗？\n画面会换成这张桌子。还没保存的修改会丢掉。浏览器里已经保存的项目不会被改掉，除非你之后自己点“保存项目”。`
    );
    if (!confirmed) return;
    const nextObjects = hydrateProjectObjects(project.objects || []);
    const nextConnections = project.connections || [];
    galleryReturnRef.current = null;
    setGalleryView(false);
    setGalleryTitle('');
    replacePageHash('');
    setShowGallery(false);
    setProjectLoadFailed(Boolean(storedLoadFailedRef.current));
    setRoom(project.room);
    setInputRoom(project.room);
    setObjects(nextObjects);
    setConnections(nextConnections);
    setCameraConfig(project.camera || null);
    if (visitorLayoutRef.current !== null) setSavedLayout(visitorLayoutRef.current);
    setCameraDirty(true);
    setSelectedObjectId(null);
    resetHistory();
    const sameAsSaved = visitorLayoutRef.current !== null
      && visitorLayoutRef.current === serializeLayout(project.room, nextObjects, nextConnections);
    showStatus({
      text: storedLoadFailedRef.current
        ? '你原来的存档读不出来，这张桌子只留在当前页面，没有写入浏览器。'
        : sameAsSaved
          ? '这张桌子和你已保存的项目一样。'
          : '已复制到当前项目，尚未保存。你原来的存档还在，要点“保存项目”才会替换。',
      type: 'success',
    }, 5000);
  };

  const handleCopyGalleryDesk = (desk) => {
    if (galleryView || !projectEditable) {
      adoptGalleryProject(desk.project, desk.title);
      return;
    }
    applyGeneratedScene({
      room: desk.project.room,
      objects: hydrateProjectObjects(desk.project.objects || []),
      connections: desk.project.connections || [],
      camera: desk.project.camera || null,
    }, `已复制“${desk.title}”`);
    setShowGallery(false);
  };

  const replaceWithProject = (project, message) => {
    const importedObjects = hydrateProjectObjects(project.objects || []);
    const importedConnections = project.connections || [];
    if (savedLayout === null) {
      setSavedLayout(serializeLayout(room, objects, connections));
    }
    recordHistory(null, {
      includeCamera: true,
      camera: getCurrentCamera(),
      cameraDirty,
    });
    setRoom(project.room);
    setInputRoom(project.room);
    setObjects(importedObjects);
    setConnections(importedConnections);
    setCameraConfig(project.camera || null);
    setCameraDirty(true);
    setSelectedObjectId(null);
    setConnectionMode(false);
    setConnectionDraft({});
    setHoveredDeviceId(null);
    showStatus({ text: message, type: 'success' }, 3000);
  };

  const handleSaveLayoutScheme = (name) => {
    if (!projectEditable) return false;
    const result = addLayoutScheme(layoutSchemes, {
      id: createEntityId('scheme'),
      name,
      savedAt: new Date().toISOString(),
      project: { room, objects, connections, camera: getCurrentCamera() },
    });
    if (!result.ok) {
      showStatus({
        text: result.reason === 'full' ? '最多留下 3 套摆法' : '请给这套摆法起个名字',
        type: 'error',
      }, 4000);
      return false;
    }
    setLayoutSchemes(result.schemes);
    showStatus({ text: `已留下摆法「${result.schemes[result.schemes.length - 1].name}」`, type: 'success' }, 3000);
    return true;
  };

  const handleSwitchLayoutScheme = (scheme) => {
    if (!projectEditable) return;
    const shouldSwitch = window.confirm(
      `确定用「${scheme.name}」替换当前桌面吗？\n当前桌面如果还没留下摆法，这次替换不会留副本。替换后仍需点击“保存项目”。`
    );
    if (!shouldSwitch) return;
    replaceWithProject(scheme.project, `已换成摆法「${scheme.name}」，尚未保存`);
    setShowLayoutSchemes(false);
  };

  const handleDeleteLayoutScheme = (scheme) => {
    if (!projectEditable) return;
    const shouldDelete = window.confirm(`确定删除摆法「${scheme.name}」吗？当前桌面不会变。`);
    if (!shouldDelete) return;
    setLayoutSchemes(current => removeLayoutScheme(current, scheme.id));
    showStatus({ text: `已删除摆法「${scheme.name}」`, type: 'success' }, 3000);
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
      const result = screenUntrustedProject(await projectClient.validate(parsed));

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
    // Real devices are already plugged in and cabled: draw the new device's
    // power, video and network lines for the user where a free port exists.
    const settled = settleNewDevice(result.object);
    setObjects(settled.objects);
    if (settled.connections !== connections) setConnections(settled.connections);
    setSelectedObjectId(settled.device.id);
    return settled.device;
  }, [connections, objects, projectEditable, recordHistory, room, settleNewDevice, showStatus]);

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
    // The layout moves with the walls as one piece (E49).
    const result = refitLayoutToRoom(room, inputRoom, objects);
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
    viewKind: galleryView ? 'gallery' : null,
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
  // Comfort and tidiness tips, only worked out while the dialog is open
  // (E56): they are optional and not counted on the toolbar.
  const layoutTips = useMemo(
    () => (showRecommendations ? buildLayoutTips({ room, objects, connections }) : []),
    [showRecommendations, room, objects, connections]
  );

  const cableShoppingList = useMemo(
    () => buildCableShoppingList(connections, objects),
    [connections, objects],
  );
  const cableRunSheet = useMemo(
    () => buildCableRunSheet(connections, objects),
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

  const layoutAutoFixCodes = ['drop_to_support', 'push_onto_support', 'move_inside_room', 'snap_outlet_to_wall'];
  const layoutAutoFixableCount = layoutIssues.filter(issue =>
    issue.code === 'floating_object' || issue.code === 'overhanging_object' || issue.code === 'out_of_bounds' || issue.code === 'outlet_off_wall'
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
    setObjects(current => updateWithRiders(current, snapped, room));
    setSelectedObjectId(objectId);
    showStatus({ text: '物体已落到下方支撑面', type: 'success' });
  };

  const handlePushOntoSupport = (objectId) => {
    if (!projectEditable) return;
    const object = objects.find(candidate => candidate.id === objectId);
    if (!object) return;
    const pushed = pushOntoSupport(room, object, objects);
    if (!pushed) {
      showStatus({ text: '推不回去：那里有别的东西，请手动挪一下', type: 'error' });
      return;
    }
    recordHistory();
    setObjects(current => updateWithRiders(current, pushed, room));
    setSelectedObjectId(objectId);
    showStatus({ text: '已推回去，放稳了', type: 'success' });
  };

  const handleApplyLayoutTip = (tip) => {
    if (!projectEditable) return;
    const result = applyLayoutTip({ room, objects, connections }, tip);
    if (!result.project) {
      showStatus({ text: `这条建议现在做不了：${result.reasons.join('，')}`, type: 'error' });
      return;
    }
    recordHistory();
    setObjects(result.project.objects);
    setConnections(result.project.connections);
    showStatus({ text: `已调整：${tip.title}`, type: 'success' }, 3000);
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
    setObjects(current => updateWithRiders(current, constrained.object, room));
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
    closeMoreMenu({ restoreFocus: true });
    action();
  };

  useEffect(() => {
    if (!moreMenuPosition) return undefined;
    const menu = moreMenuRef.current;
    if (!menu) return undefined;
    const itemList = () => [...menu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')]
      .filter(element => !element.disabled);
    const focusAt = (index) => {
      const items = itemList();
      if (items.length === 0) return;
      items[(index + items.length) % items.length].focus();
    };
    focusAt(0);
    const handlePointerDown = (event) => {
      if (menu.contains(event.target) || moreButtonRef.current?.contains(event.target)) return;
      closeMoreMenu();
    };
    const handleKeyDown = (event) => {
      if (menuClosesOnKey(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        closeMoreMenu({ restoreFocus: true });
        return;
      }
      const next = nextMenuIndex({
        key: event.key,
        index: itemList().indexOf(document.activeElement),
        count: itemList().length,
      });
      if (next === null) return;
      event.preventDefault();
      event.stopPropagation();
      focusAt(next);
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
  const titleLabel = <span className="toolbar-label">DeskLab</span>;
  const templatesButton = <button className="ui-button" onClick={() => { setScrollTemplatesToBuilder(false); setShowTemplates(true); }} disabled={!projectEditable}>桌面模板</button>;
  const galleryButton = <button className="ui-button" onClick={() => setShowGallery(true)} disabled={!projectEditable && !galleryView}>社区图库</button>;
  const undoButton = <button className="ui-button" onClick={handleUndo} disabled={!projectEditable || !historyStatus.canUndo} title="撤销 (Ctrl+Z)">撤销</button>;
  const redoButton = <button className="ui-button" onClick={handleRedo} disabled={!projectEditable || !historyStatus.canRedo} title="重做 (Ctrl+Y)">重做</button>;
  const resetViewButton = <button className="ui-button" onClick={handleResetView} disabled={!projectEditable && !shareView && !galleryView}>重置视角</button>;
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
      aria-controls="toolbar-more-menu"
    >
      更多
    </button>
  );
  const moreMenu = moreMenuPosition && (
    <div
      ref={moreMenuRef}
      id="toolbar-more-menu"
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
      <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(() => setShowLayoutSchemes(true))} disabled={!projectLoaded || projectLoadFailed}>我的摆法</button>
      <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(handleOpenShareLink)} disabled={!projectLoaded || projectLoadFailed}>复制分享链接</button>
      <button type="button" className="toolbar-menu-item" role="menuitem" onClick={() => runMoreMenuAction(() => { setInputRoom({ length: room.length, width: room.width, height: room.height }); setShowSettings(true); })} disabled={!projectEditable}>设置</button>
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
      titleLabel={titleLabel}
      templatesButton={templatesButton}
      galleryButton={galleryButton}
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
    <div className={entryOpen ? 'app-shell app-shell-entering' : 'app-shell'}>
      {/* 顶部控制栏 */}
      <div className="app-top">
        {appToolbar}

        {onPhone && !phoneNoticeDismissed && (
          <PhoneNoticeBanner onCopyLink={handleCopyPageLink} onDismiss={handleDismissPhoneNotice} />
        )}

        {shareView && (
          <ShareViewBanner onCopyIn={handleAdoptShare} />
        )}

        {galleryView && (
          <GalleryViewBanner
            title={galleryTitle}
            onBack={handleReturnFromGallery}
            onCopyIn={() => adoptGalleryProject({ room, objects, connections, camera: getCurrentCamera() }, galleryTitle)}
          />
        )}

        {recoveryDraft && !shareView && !galleryView && (
          <DraftRecoveryBanner
            savedAt={recoveryDraft.savedAt}
            onRestore={handleRestoreDraft}
            onExport={handleExportRecoveryDraft}
            onDiscard={handleDiscardDraft}
          />
        )}

        {showBackupReminder && !recoveryDraft && !projectLoadFailed && !galleryView && (
          <BackupReminderBanner fileArchive={fileArchive} onExport={handleExportProject} onSnooze={handleSnoozeBackupReminder} />
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
              viewOnly: shareView || galleryView,
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
          {entryStep === 'desk' && (
            <EntryDeskStep
              roomSummary={formatEntryRoom(room)}
              onPreset={handleEntryPreset}
              onCustom={handleEntryCustom}
            />
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

      {showAbout && <AboutDialog fileArchive={fileArchive} onClose={() => setShowAbout(false)} />}
      {showLayoutSchemes && (
        <LayoutSchemesDialog
          schemes={layoutSchemes}
          editable={projectEditable}
          onSave={handleSaveLayoutScheme}
          onSwitch={handleSwitchLayoutScheme}
          onDelete={handleDeleteLayoutScheme}
          onClose={() => setShowLayoutSchemes(false)}
        />
      )}

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

      {showGallery && (
        <CommunityGalleryDialog
          canPublish={projectEditable}
          hasObjects={objects.length > 0}
          currentProject={() => ({ room, objects, connections, camera: getCurrentCamera() })}
          onClose={() => setShowGallery(false)}
          onOpen={handleOpenGalleryDesk}
          onCopy={handleCopyGalleryDesk}
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
          onPushOntoSupport={handlePushOntoSupport}
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
          sheet={cableRunSheet}
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

      {showSettings && entryStep === 'done' && (
        <SettingsDialog
          length={inputRoom.length}
          width={inputRoom.width}
          height={inputRoom.height}
          disabled={!projectEditable}
          onChange={setInputRoom}
          onUpdate={handleUpdateRoom}
          onRepick={() => {
            setShowSettings(false);
            setRoomRepick(true);
            setEntryStep('room');
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {entryStep === 'room' && (
        <EntryRoomPage
          repick={roomRepick}
          onConfirm={handleConfirmEntryRoom}
          onCancel={() => {
            setRoomRepick(false);
            setEntryStep('done');
          }}
        />
      )}

      {guideOpen && (
        <OnboardingGuide
          stepIndex={guideStep}
          canEdit={projectEditable}
          fileArchive={fileArchive}
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
          onPushOntoSupport={handlePushOntoSupport}
          tips={layoutTips}
          onApplyTip={handleApplyLayoutTip}
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
