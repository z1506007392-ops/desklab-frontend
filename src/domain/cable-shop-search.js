// Plain store search for a cable-list row (E97). DeskLab does not write a
// price, and these URLs carry no affiliate or tracking parameters. The shop
// page decides what is in stock and what it costs.

const STORES = Object.freeze([
  {
    id: 'jd',
    label: '京东',
    host: 'search.jd.com',
    href: keyword => `https://search.jd.com/Search?keyword=${keyword}&enc=utf-8`,
  },
  {
    id: 'taobao',
    label: '淘宝',
    host: 's.taobao.com',
    href: keyword => `https://s.taobao.com/search?q=${keyword}`,
  },
]);

function encodedKeyword(name) {
  const keyword = [...String(name ?? '')]
    .filter(char => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .trim();
  if (!keyword) return '';
  return encodeURIComponent(keyword);
}

/**
 * Search links for one shopping-list name, such as "2 米 HDMI 线".
 * Returns [{ id, label, href }]. An empty name returns none.
 */
export function cableShopSearchLinks(name) {
  const keyword = encodedKeyword(name);
  if (!keyword) return [];
  return STORES.map(store => {
    const href = store.href(keyword);
    const url = new URL(href);
    return {
      id: store.id,
      label: store.label,
      href: url.hostname === store.host && url.protocol === 'https:' ? href : '',
    };
  }).filter(link => link.href);
}

/**
 * A local shell (Tauri) can set globalThis.__desklabOpenExternal to hand the
 * https URL to the system browser. Without that hook the caller leaves the
 * link alone, so a normal browser tab still opens it. Never calls DeskLab.
 */
export function openExternalHttps(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const opener = globalThis.__desklabOpenExternal;
  if (typeof opener !== 'function') return false;
  opener(url.href);
  return true;
}
