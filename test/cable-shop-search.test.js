import test from 'node:test';
import assert from 'node:assert/strict';

import { cableShopSearchLinks, openExternalHttps } from '../src/domain/cable-shop-search.js';

function params(href) {
  return new URL(href).searchParams;
}

test('each cable name opens a Jingdong and a Taobao search', () => {
  const links = cableShopSearchLinks('2 米 HDMI 线');
  assert.deepEqual(links.map(link => link.label), ['京东', '淘宝']);
  const jd = links[0].href;
  const taobao = links[1].href;
  assert.equal(new URL(jd).hostname, 'search.jd.com');
  assert.equal(params(jd).get('keyword'), '2 米 HDMI 线');
  assert.equal(params(jd).get('enc'), 'utf-8');
  assert.equal(new URL(taobao).hostname, 's.taobao.com');
  assert.equal(params(taobao).get('q'), '2 米 HDMI 线');
});

test('the search url is only the name, with no price or affiliate fields', () => {
  const links = cableShopSearchLinks('1.5 米 电源线');
  for (const link of links) {
    const url = new URL(link.href);
    assert.equal(url.protocol, 'https:');
    const keys = [...url.searchParams.keys()];
    assert.ok(keys.every(key => key === 'keyword' || key === 'enc' || key === 'q'));
    assert.equal(url.searchParams.get('price'), null);
    assert.doesNotMatch(link.href, /utm_|cps|union|click\.|¥|元/);
  }
});

test('characters that would change the query are encoded', () => {
  const [jd] = cableShopSearchLinks('2 米 HDMI 线 & 转接头');
  assert.equal(params(jd.href).get('keyword'), '2 米 HDMI 线 & 转接头');
  assert.match(jd.href, /%26/);
});

test('a blank name does not invent a search', () => {
  assert.deepEqual(cableShopSearchLinks(''), []);
  assert.deepEqual(cableShopSearchLinks('   '), []);
  assert.deepEqual(cableShopSearchLinks(null), []);
});

test('a local shell can open the https search without DeskLab', () => {
  const seen = [];
  globalThis.__desklabOpenExternal = href => seen.push(href);
  try {
    const [jd] = cableShopSearchLinks('2 米 HDMI 线');
    assert.equal(openExternalHttps(jd.href), true);
    assert.deepEqual(seen, [jd.href]);
    assert.equal(openExternalHttps('http://search.jd.com/Search?keyword=hdmi'), false);
    assert.equal(openExternalHttps('javascript:alert(1)'), false);
    assert.equal(seen.length, 1);
  } finally {
    delete globalThis.__desklabOpenExternal;
  }
  assert.equal(openExternalHttps('https://search.jd.com/Search?keyword=hdmi'), false);
});
