import { connectionHasBuiltInCable, shopCableLength } from './cable-shopping-list.js';
import { describeCableType, getConnectionRoute } from './connections.js';

// A wired keyboard or mouse brings its own cable (E60). The run sheet still
// lists it, and the shop column says so instead of a length to buy.

const SHEET_HEADERS = ['起点设备', '起点接口', '终点设备', '终点接口', '类型', '走线长度（米）', '购买长度（米）'];

function endpointName(object, portId) {
  if (!object) return { device: '未知设备', port: '未知接口' };
  const port = (object.ports || []).find(candidate => candidate.id === portId);
  return {
    device: object.name || '未命名设备',
    port: port?.name || (portId ? String(portId) : '未知接口'),
  };
}

function isLineBreak(code) {
  return code === 10 || code === 13 || code === 11 || code === 12 || code === 0x85
    || code === 0x2028 || code === 0x2029;
}

function markdownCell(value) {
  const raw = value == null ? '' : String(value);
  let out = '';
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const code = char.charCodeAt(0);
    if (char === '|') {
      out += '∣';
      continue;
    }
    if (char === '<') {
      out += '＜';
      continue;
    }
    if (char === '>') {
      out += '＞';
      continue;
    }
    if (code === 13 && raw.charCodeAt(index + 1) === 10) {
      out += ' ';
      index += 1;
      continue;
    }
    if (isLineBreak(code)) {
      out += ' ';
      continue;
    }
    out += char;
  }
  return out;
}

function formatMetres(length) {
  if (!Number.isFinite(length)) return '';
  return String(Math.round(length * 100) / 100);
}

function startsSpreadsheetFormula(text) {
  if (!text) return false;
  const code = text.charCodeAt(0);
  return text[0] === '=' || text[0] === '+' || text[0] === '-' || text[0] === '@' || code === 9 || code === 13;
}

function csvNeedsQuotes(text) {
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (char === '"' || char === ',' || code === 10 || code === 13 || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (startsSpreadsheetFormula(text)) text = `'${text}`;
  if (!csvNeedsQuotes(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function installRank(row, powerTargets) {
  if (row.cableType !== 'power') return 2;
  return powerTargets.has(row.fromObjectId) ? 1 : 0;
}

/**
 * One row per drawn cable, plus Markdown and CSV. The install list puts
 * power first (a cable that feeds another power cable comes before it),
 * then signal cables in the order they were drawn.
 */
export function buildCableRunSheet(connections, objects) {
  const list = Array.isArray(connections) ? connections : [];
  const items = Array.isArray(objects) ? objects : [];
  const objectsById = new Map(items.map(object => [object.id, object]));
  const rows = [];
  for (const connection of list) {
    if (!connection || typeof connection !== 'object') continue;
    const from = endpointName(objectsById.get(connection.fromObjectId), connection.fromPortId);
    const to = endpointName(objectsById.get(connection.toObjectId), connection.toPortId);
    const route = getConnectionRoute(connection, items);
    const builtIn = connectionHasBuiltInCable(connection, objectsById);
    const shop = builtIn ? null : shopCableLength(route?.length ?? NaN);
    rows.push({
      fromDevice: from.device,
      fromPort: from.port,
      toDevice: to.device,
      toPort: to.port,
      cableType: connection.cableType,
      typeLabel: describeCableType(connection.cableType),
      routeMetres: Number.isFinite(route?.length) ? route.length : null,
      shopMetres: shop,
      builtIn,
      fromObjectId: connection.fromObjectId,
      toObjectId: connection.toObjectId,
    });
  }

  const powerTargets = new Set(rows.filter(row => row.cableType === 'power').map(row => row.toObjectId));
  const installRows = rows
    .map((row, index) => ({ row, index }))
    .sort((first, second) => {
      const rank = installRank(first.row, powerTargets) - installRank(second.row, powerTargets);
      return rank || first.index - second.index;
    })
    .map(item => item.row);

  const markdown = renderMarkdown(rows, installRows);
  const csv = `\uFEFF${renderCsv(rows)}`;
  return { rows, installRows, markdown, csv };
}

function lengthPhrase(row) {
  const route = row.routeMetres == null ? '走线长度未知' : `走线 ${formatMetres(row.routeMetres)} 米`;
  if (row.builtIn) return `${route}，这根线是自带的，不用另买`;
  if (row.shopMetres == null) return route;
  return `${route}，购买 ${formatMetres(row.shopMetres)} 米`;
}

function renderInstall(installRows) {
  if (installRows.length === 0) return '当前没有需要列出的线。';
  const steps = installRows.map((row, index) => (
    `${index + 1}. ${markdownCell(row.typeLabel)}：从「${markdownCell(row.fromDevice)}」的「${markdownCell(row.fromPort)}」接到「${markdownCell(row.toDevice)}」的「${markdownCell(row.toPort)}」。${lengthPhrase(row)}。`
  ));
  return ['先接电源，再接信号。', '', ...steps].join('\n');
}

function renderMarkdown(rows, installRows) {
  const table = rows.length === 0
    ? '当前没有需要列出的线。'
    : [
      `| ${SHEET_HEADERS.join(' | ')} |`,
      `| ${SHEET_HEADERS.map(() => '---').join(' | ')} |`,
      ...rows.map(row => `| ${[
        row.fromDevice,
        row.fromPort,
        row.toDevice,
        row.toPort,
        row.typeLabel,
        formatMetres(row.routeMetres),
        row.builtIn ? '自带' : formatMetres(row.shopMetres),
      ].map(markdownCell).join(' | ')} |`),
    ].join('\n');
  return ['# 布线表', '', table, '', '# 安装清单', '', renderInstall(installRows), ''].join('\n');
}

function renderCsv(rows) {
  const lines = [SHEET_HEADERS.join(',')];
  for (const row of rows) {
    lines.push([
      row.fromDevice,
      row.fromPort,
      row.toDevice,
      row.toPort,
      row.typeLabel,
      formatMetres(row.routeMetres),
      row.builtIn ? '自带' : formatMetres(row.shopMetres),
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}
