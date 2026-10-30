// A stand-in for DeepSeek for local development and demos (AI_MOCK=1 in
// tools/dev-api-server.mjs). It reads the scene from the prompt and returns
// a small, predictable answer in DeepSeek's response format: centre the
// first monitor on its desk, and move a tower PC off the desk to the floor
// beside it. It is not used in production.
function sceneFromMessages(messages) {
  const user = messages.find(message => message.role === 'user')?.content ?? '';
  const line = user.split('\n')[1];
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

const cm = value => Math.round(value * 100) / 100;

export function mockSuggestions(scene) {
  const objects = Array.isArray(scene?.objects) ? scene.objects : [];
  const desks = new Map(objects.filter(object => object.kind === 'office-desk').map(desk => [desk.id, desk]));
  const suggestions = [];

  const monitor = objects.find(object => /monitor/.test(object.kind ?? '') && desks.has(object.restingOn));
  if (monitor) {
    const desk = desks.get(monitor.restingOn);
    if (Math.abs(monitor.center[0] - desk.center[0]) > 0.05) {
      suggestions.push({
        id: 'mock-1',
        title: '显示器移到正前方',
        reason: '显示器正对座位，看屏幕时不用歪头。',
        category: 'ergonomics',
        actions: [{ type: 'move', objectId: monitor.id, x: cm(desk.center[0]), y: cm(monitor.center[1]) }],
      });
    }
  }

  const tower = objects.find(object => object.kind === 'desktop-pc' && desks.has(object.restingOn));
  if (tower) {
    const desk = desks.get(tower.restingOn);
    suggestions.push({
      id: 'mock-2',
      title: '主机放到桌子旁边地上',
      reason: '桌面空出来更宽敞，主机在地上也更稳当。',
      category: 'space',
      actions: [{
        type: 'move',
        objectId: tower.id,
        x: cm(desk.center[0] + desk.size[0] / 2 + tower.size[0] / 2 + 0.1),
        y: cm(desk.center[1]),
        z: cm(tower.size[2] / 2),
      }],
    });
  }
  return suggestions;
}

export function createMockFetch({ delayMs = 300 } = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    const suggestions = mockSuggestions(sceneFromMessages(body.messages));
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return new Response(JSON.stringify({
      model: 'mock',
      choices: [{ message: { role: 'assistant', content: JSON.stringify({ suggestions }) } }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}
