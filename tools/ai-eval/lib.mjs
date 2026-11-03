// Offline evaluation of the AI layout suggestions (roadmap task C6).
// Scenes are built in code from the templates so they follow catalog and
// template changes; each "messy" scene breaks one rule a good desk keeps.
import { evaluateSuggestions, parseAiResponse } from '../../src/domain/ai-actions.js';
import { buildSceneSummary } from '../../src/domain/ai-scene-summary.js';
import { hydrateProjectObjects } from '../../src/domain/catalog.js';
import { buildTemplateScene } from '../../src/domain/desk-templates.js';
import { buildDeskScene } from '../../src/domain/scene-builder.js';

export const THRESHOLDS = Object.freeze({
  parseRate: 0.98,
  messyHelpedRate: 0.8,
  averageImprovement: 0,
  newErrors: 0,
  jargonRate: 0,
});

const GOALS = ['', '更整洁', '适合打游戏', '双屏办公', '显示器正对我', '主机别挡腿', '线少一点', '不要动笔记本'];

function edit(project, modelId, change) {
  return {
    ...project,
    objects: project.objects.map(object => (object.modelId === modelId ? change(structuredClone(object)) : object)),
  };
}

const deskOf = project => project.objects.find(object => object.modelId === 'office-desk');
const deskTop = project => { const desk = deskOf(project); return desk.position.z + desk.scale.z / 2; };

const MESSES = [
  ['monitor-off-centre', project => {
    const monitor = project.objects.find(object => /monitor/.test(object.modelId));
    return edit(project, monitor.modelId, m => { m.position.x += 0.35; return m; });
  }],
  ['monitor-turned-away', project => {
    const monitor = project.objects.find(object => /monitor/.test(object.modelId));
    return edit(project, monitor.modelId, m => { m.rotation.z = 120; return m; });
  }],
  ['laptop-at-back', project => {
    const desk = deskOf(project);
    // The photographed presets have no open laptop. The recorded scene id
    // still needs one, sitting at the back with nothing to type on.
    let base = project;
    if (!base.objects.some(object => object.modelId === 'laptop-15')) {
      base = buildDeskScene({
        devices: [{ modelId: 'laptop-15', count: 1 }, { modelId: 'monitor-27', count: 1 }],
        desk: { length: desk.scale.x, depth: desk.scale.y },
      });
    }
    const objects = base.objects.filter(object => object.modelId !== 'keyboard' && object.modelId !== 'mouse');
    const ids = new Set(objects.map(object => object.id));
    const next = {
      ...base,
      objects,
      connections: base.connections.filter(connection => ids.has(connection.fromObjectId) && ids.has(connection.toObjectId)),
    };
    const seatDesk = deskOf(next);
    return edit(next, 'laptop-15', laptop => {
      laptop.position.y = seatDesk.position.y + seatDesk.scale.y / 2 - laptop.scale.y / 2 - 0.02;
      return laptop;
    });
  }],
  ['tower-in-legroom', project => {
    if (!project.objects.some(object => object.modelId === 'desktop-pc')) return null;
    const desk = deskOf(project);
    return edit(project, 'desktop-pc', pc => { pc.position.x = 0; pc.position.y = desk.position.y; return pc; });
  }],
  ['strip-on-desk', project => {
    const desk = deskOf(project);
    return edit(project, 'power-strip', s => {
      s.position = { x: -desk.scale.x / 2 + s.scale.x / 2 + 0.02, y: desk.position.y - desk.scale.y / 2 + 0.08, z: deskTop(project) + s.scale.z / 2 };
      return s;
    });
  }],
  ['cable-too-long', project => {
    const video = project.connections.find(c => c.cableType !== 'power');
    if (!video) return null;
    return { ...project, connections: project.connections.map(c => (c.id === video.id ? { ...c, length: 10 } : c)) };
  }],
  ['monitor-too-close', project => {
    const monitor = project.objects.find(object => /monitor/.test(object.modelId));
    const desk = deskOf(project);
    return edit(project, monitor.modelId, item => {
      item.position.y = desk.position.y - desk.scale.y / 2 + item.scale.y / 2 + 0.01;
      return item;
    });
  }],
  ['tower-on-desk', project => {
    if (!project.objects.some(object => object.modelId === 'desktop-pc')) return null;
    const desk = deskOf(project);
    return edit(project, 'desktop-pc', pc => {
      pc.position = { x: desk.position.x, y: desk.position.y, z: deskTop(project) + pc.scale.z / 2 };
      return pc;
    });
  }],
  ['router-buried', project => {
    if (!project.objects.some(object => object.modelId === 'router')) return null;
    const desk = deskOf(project);
    return edit(project, 'router', router => {
      router.position = { x: desk.position.x, y: desk.position.y, z: router.scale.z / 2 };
      return router;
    });
  }],
];

/** The evaluation scenes: { id, kind: 'good' | 'messy' | 'legacy', project, goals }. */
export function buildEvalScenes() {
  const scenes = [];
  for (const templateId of ['home-office', 'desktop-dual', 'gaming']) {
    const base = buildTemplateScene(templateId);
    scenes.push({ id: `${templateId}`, kind: 'good', project: base, goals: [''] });
    let added = 0;
    for (const [messId, mess] of MESSES) {
      const project = mess(buildTemplateScene(templateId));
      if (!project) continue;
      scenes.push({ id: `${templateId}/${messId}`, kind: 'messy', project, goals: [GOALS[added % GOALS.length], GOALS[(added + 1) % GOALS.length]] });
      added += 1;
    }
  }

  // Old-save shapes: a closed-lid laptop height, a removed device, and a
  // generated desk with an off-centre screen; all go through hydration.
  const legacy = buildDeskScene({
    devices: [{ modelId: 'laptop-15', count: 1 }, { modelId: 'keyboard', count: 1 }],
    desk: { length: 1.2, depth: 0.7 },
  });
  scenes.push({
    id: 'legacy/closed-lid-laptop',
    kind: 'legacy',
    project: { ...legacy, objects: hydrateProjectObjects(edit(legacy, 'laptop-15', l => { l.position.z = deskTop(legacy) + 0.029; l.scale.z = 0.058; return l; }).objects) },
    goals: [''],
  });
  const withMiniPc = buildTemplateScene('desktop-dual');
  const desk = deskOf(withMiniPc);
  scenes.push({
    id: 'legacy/mini-pc',
    kind: 'legacy',
    project: {
      ...withMiniPc,
      objects: hydrateProjectObjects([...withMiniPc.objects, {
        id: 'mini', name: '迷你主机', type: 'mini-pc', category: 'computer', modelId: 'mini-pc', shape: 'rect',
        position: { x: desk.position.x - desk.scale.x / 2 + 0.1, y: desk.position.y - 0.2, z: deskTop(withMiniPc) + 0.025 },
        rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.12, y: 0.12, z: 0.05 }, ports: [],
      }]),
    },
    goals: ['更整洁'],
  });
  const generated = buildDeskScene({ devices: [{ modelId: 'laptop-15', count: 1 }, { modelId: 'monitor-27', count: 1 }], desk: { length: 1.2, depth: 0.6 } });
  scenes.push({
    id: 'legacy/generated-off-centre',
    kind: 'messy',
    project: edit(generated, 'monitor-27', m => { m.position.x += 0.3; return m; }),
    goals: [''],
  });

  const deskOnly = buildDeskScene({ devices: [], desk: { length: 1.4, depth: 0.7 } });
  scenes.push({ id: 'desk-only', kind: 'good', project: deskOnly, goals: [''] });

  // Comfort messes the templates do not contain: a console, lamp, speakers
  // and a mouse that has wandered off. Built from a generated desk the
  // heuristics already accept, then one device is moved.
  const furnished = () => buildDeskScene({
    devices: [
      { modelId: 'laptop-15', count: 1 },
      { modelId: 'monitor-24', count: 1 },
      { modelId: 'keyboard', count: 1 },
      { modelId: 'mouse', count: 1 },
      { modelId: 'desk-lamp', count: 1 },
      { modelId: 'speakers', count: 1 },
      { modelId: 'game-console', count: 1 },
    ],
    desk: { length: 1.6, depth: 0.8 },
  });
  const onDesk = (project, modelId, localX) => {
    const desk = deskOf(project);
    const item = project.objects.find(object => object.modelId === modelId);
    return edit(project, modelId, device => {
      device.position = {
        x: desk.position.x + localX,
        y: desk.position.y - desk.scale.y / 2 + device.scale.y / 2 + 0.02,
        z: deskTop(project) + device.scale.z / 2,
      };
      return device;
    });
  };
  const comfort = [
    ['console-on-desk', project => {
      const desk = deskOf(project);
      const item = project.objects.find(object => object.modelId === 'game-console');
      return edit(project, 'game-console', device => {
        device.position = { x: desk.position.x, y: desk.position.y, z: deskTop(project) + item.scale.z / 2 };
        return device;
      });
    }],
    ['lamp-in-front', project => onDesk(project, 'desk-lamp', 0.2)],
    ['speakers-in-front', project => onDesk(project, 'speakers', -0.2)],
    ['mouse-far', project => {
      const desk = deskOf(project);
      const mouse = project.objects.find(object => object.modelId === 'mouse');
      return edit(project, 'mouse', device => {
        device.position = {
          x: desk.position.x + desk.scale.x / 2 - mouse.scale.x / 2 - 0.04,
          y: desk.position.y,
          z: deskTop(project) + device.scale.z / 2,
        };
        return device;
      });
    }],
  ];
  for (const [messId, mess] of comfort) {
    scenes.push({ id: `comfort/${messId}`, kind: 'messy', project: mess(furnished()), goals: ['更整洁'] });
  }
  return scenes;
}

// Latin words in text meant for people, other than brand-style names.
const JARGON = /\b(?!HDMI\b|USB\b|DP\b|DC\b|AC\b|DeepSeek\b|Wi-Fi\b)[A-Za-z]{3,}\b|[a-z]+-\d|[a-z]+_[a-z]+/;

/**
 * Run every scene and goal through `post(body) -> { status, json }` and
 * collect per-request results. `post` is the HTTP call for a real run and an
 * in-process handler in tests. `skip(sceneId, goal)` leaves out pairs done
 * in an earlier run; `onResult` returning 'stop' ends the run early (for
 * example on a rate limit) and the results so far are returned.
 */
export async function runEval({ post, scenes = buildEvalScenes(), onResult = () => {}, skip = () => false }) {
  const results = [];
  for (const scene of scenes) {
    for (const goal of scene.goals) {
      if (skip(scene.id, goal)) continue;
      const started = Date.now();
      let status = 0;
      let json = null;
      try {
        ({ status, json } = await post({ version: 1, summary: buildSceneSummary(scene.project), goal }));
      } catch (error) {
        json = { error: String(error) };
      }
      const parsed = status === 200 && Array.isArray(json?.suggestions);
      const raw = parsed ? json.suggestions : [];
      const accepted = parsed ? evaluateSuggestions(scene.project, parseAiResponse(json)) : [];
      const result = {
        scene: scene.id,
        kind: scene.kind,
        goal,
        status,
        ms: Date.now() - started,
        parsed,
        rawCount: raw.length,
        acceptedCount: accepted.length,
        improvement: accepted.reduce((sum, item) => sum + (item.scoreBefore.total - item.scoreAfter.total), 0),
        newErrors: accepted.reduce((sum, item) => sum + Math.max(0, item.scoreAfter.errors - item.scoreBefore.errors), 0),
        jargon: raw.filter(item => JARGON.test(`${item.title ?? ''} ${item.reason ?? ''}`)).length,
        response: json,
      };
      results.push(result);
      if (onResult(result) === 'stop') return results;
    }
  }
  return results;
}

export function summarize(results) {
  const total = results.length;
  const parsed = results.filter(result => result.parsed);
  const messy = results.filter(result => result.kind === 'messy');
  const accepted = results.flatMap(result => (result.acceptedCount > 0 ? [result] : []));
  const rawSuggestions = results.reduce((sum, result) => sum + result.rawCount, 0);
  const metrics = {
    requests: total,
    parseRate: total ? parsed.length / total : 0,
    messyHelpedRate: messy.length ? messy.filter(result => result.acceptedCount > 0).length / messy.length : 0,
    averageImprovement: accepted.length ? accepted.reduce((sum, result) => sum + result.improvement, 0) / accepted.length : 0,
    newErrors: results.reduce((sum, result) => sum + result.newErrors, 0),
    jargonRate: rawSuggestions ? results.reduce((sum, result) => sum + result.jargon, 0) / rawSuggestions : 0,
    acceptedSuggestions: results.reduce((sum, result) => sum + result.acceptedCount, 0),
    rawSuggestions,
  };
  const checks = {
    parseRate: metrics.parseRate >= THRESHOLDS.parseRate,
    messyHelpedRate: metrics.messyHelpedRate >= THRESHOLDS.messyHelpedRate,
    averageImprovement: metrics.averageImprovement > THRESHOLDS.averageImprovement,
    newErrors: metrics.newErrors === THRESHOLDS.newErrors,
    jargonRate: metrics.jargonRate === THRESHOLDS.jargonRate,
  };
  return { metrics, checks, passed: Object.values(checks).every(Boolean) };
}
