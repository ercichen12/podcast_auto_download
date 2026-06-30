import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildSearchRequest,
  createXiaoyuzhouHeaders,
  isWithinLookbackDays,
  loadXiaoyuzhouCredentials,
  loginXiaoyuzhouWithSms,
  normalizeSearchEpisode,
  refreshXiaoyuzhouAccessToken,
  sendXiaoyuzhouSmsCode,
  searchXiaoyuzhouEpisodes,
} from '../src/xiaoyuzhou-search.js';

test('buildSearchRequest creates Xiaoyuzhou episode search payload', () => {
  assert.deepEqual(buildSearchRequest('AI', 20), {
    path: '/v1/search/create',
    payload: {
      keyword: 'AI',
      type: 'EPISODE',
      limit: '20',
      sourcePageName: '4',
      currentPageName: '4',
    },
  });
});

test('createXiaoyuzhouHeaders includes app identity and optional auth', () => {
  const headers = createXiaoyuzhouHeaders({
    accessToken: 'access-token',
    deviceId: 'device-id',
    now: new Date('2026-06-29T08:30:00.000Z'),
  });

  assert.equal(headers.Host, 'api.xiaoyuzhoufm.com');
  assert.equal(headers.os, 'android');
  assert.equal(headers.applicationid, 'app.podcast.cosmos');
  assert.equal(headers['content-type'], 'application/json;charset=utf-8');
  assert.equal(headers['x-jike-access-token'], 'access-token');
  assert.equal(headers['x-jike-device-id'], 'device-id');
  assert.match(headers['local-time'], /^2026-06-29T/);
});

test('normalizeSearchEpisode maps Xiaoyuzhou search hit to downloader item', () => {
  const item = normalizeSearchEpisode(
    {
      eid: 'episode-id',
      title: 'AI Agent 新进展',
      shownotes: '<p>聊聊大模型</p>',
      pubDate: '2026-06-28T10:00:00.000Z',
      enclosure: { url: 'https://cdn.example.com/fallback.mp3' },
      media: { source: { url: 'https://cdn.example.com/audio.mp3' } },
      podcast: {
        pid: 'podcast-id',
        title: '科技播客',
        author: '主播',
      },
    },
    'AI'
  );

  assert.equal(item.guid, 'xiaoyuzhou:episode:episode-id');
  assert.equal(item.title, 'AI Agent 新进展');
  assert.equal(item.link, 'https://www.xiaoyuzhoufm.com/episode/episode-id');
  assert.equal(item.pubDate, '2026-06-28T10:00:00.000Z');
  assert.equal(item.enclosure.url, 'https://cdn.example.com/audio.mp3');
  assert.equal(item.creator, '科技播客');
  assert.deepEqual(item.categories, ['xiaoyuzhou-global-search', 'AI']);
  assert.match(item.contentSnippet, /科技播客/);
  assert.match(item.contentSnippet, /大模型/);
});

test('isWithinLookbackDays keeps recent items and rejects old or invalid dates', () => {
  const now = new Date('2026-06-29T12:00:00.000Z');

  assert.equal(isWithinLookbackDays('2026-06-28T12:00:00.000Z', 7, now), true);
  assert.equal(isWithinLookbackDays('2026-06-20T12:00:00.000Z', 7, now), false);
  assert.equal(isWithinLookbackDays('', 7, now), false);
  assert.equal(isWithinLookbackDays('2026-06-20T12:00:00.000Z', 0, now), true);
});

test('loadXiaoyuzhouCredentials reads local token file without requiring settings secrets', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xyz-creds-'));
  const tokenPath = path.join(tempDir, 'token.json');
  await fs.writeFile(
    tokenPath,
    JSON.stringify({
      accessToken: 'access',
      refreshToken: 'refresh',
      deviceId: 'device',
    }),
    'utf8'
  );

  assert.deepEqual(await loadXiaoyuzhouCredentials({ tokenPath }), {
    exists: true,
    accessToken: 'access',
    refreshToken: 'refresh',
    deviceId: 'device',
    uid: '',
    nickname: '',
    tokenPath,
  });
});

test('searchXiaoyuzhouEpisodes normalizes and filters results from injected fetch', async () => {
  const requests = [];
  const result = await searchXiaoyuzhouEpisodes({
    keyword: 'AI',
    limit: 5,
    lookbackDays: 3,
    credentials: { accessToken: 'access', deviceId: 'device' },
    now: new Date('2026-06-29T12:00:00.000Z'),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            {
              eid: 'recent',
              title: 'AI 单集',
              shownotes: '大模型',
              pubDate: '2026-06-29T01:00:00.000Z',
              media: { source: { url: 'https://cdn.example.com/recent.mp3' } },
              podcast: { pid: 'p1', title: '播客一' },
            },
            {
              eid: 'old',
              title: 'AI 旧单集',
              pubDate: '2026-06-01T01:00:00.000Z',
              media: { source: { url: 'https://cdn.example.com/old.mp3' } },
              podcast: { pid: 'p2', title: '播客二' },
            },
          ],
        }),
      };
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.xiaoyuzhoufm.com/v1/search/create');
  assert.equal(JSON.parse(requests[0].options.body).keyword, 'AI');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].guid, 'xiaoyuzhou:episode:recent');
  assert.equal(result.skippedOld, 1);
});

test('refreshXiaoyuzhouAccessToken updates token file from response headers', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xyz-refresh-'));
  const tokenPath = path.join(tempDir, 'token.json');
  const refreshed = await refreshXiaoyuzhouAccessToken({
    credentials: {
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      deviceId: 'device',
      tokenPath,
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.xiaoyuzhoufm.com/app_auth_tokens.refresh');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['x-jike-refresh-token'], 'old-refresh');
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) =>
            ({
              'x-jike-access-token': 'new-access',
              'x-jike-refresh-token': 'new-refresh',
            })[name.toLowerCase()] || null,
        },
        json: async () => ({}),
      };
    },
  });

  assert.equal(refreshed.accessToken, 'new-access');
  assert.equal(refreshed.refreshToken, 'new-refresh');
  const saved = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
  assert.equal(saved.accessToken, 'new-access');
  assert.equal(saved.refreshToken, 'new-refresh');
});

test('searchXiaoyuzhouEpisodes refreshes access token once after 401 and retries', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xyz-search-refresh-'));
  const tokenPath = path.join(tempDir, 'token.json');
  const calls = [];

  const result = await searchXiaoyuzhouEpisodes({
    keyword: 'AI',
    credentials: {
      accessToken: 'expired-access',
      refreshToken: 'refresh-token',
      deviceId: 'device',
      tokenPath,
    },
    now: new Date('2026-06-29T12:00:00.000Z'),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/v1/search/create') && calls.length === 1) {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'expired',
        };
      }
      if (url.endsWith('/app_auth_tokens.refresh')) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) =>
              ({
                'x-jike-access-token': 'fresh-access',
                'x-jike-refresh-token': 'fresh-refresh',
              })[name.toLowerCase()] || null,
          },
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            {
              eid: 'fresh-result',
              title: 'AI refreshed',
              pubDate: '2026-06-29T01:00:00.000Z',
              media: { source: { url: 'https://cdn.example.com/fresh.mp3' } },
              podcast: { title: '刷新播客' },
            },
          ],
        }),
      };
    },
  });

  assert.equal(calls.length, 3);
  assert.equal(calls[2].options.headers['x-jike-access-token'], 'fresh-access');
  assert.equal(result.items[0].guid, 'xiaoyuzhou:episode:fresh-result');
  const saved = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
  assert.equal(saved.accessToken, 'fresh-access');
});

test('sendXiaoyuzhouSmsCode posts phone number to podcaster auth API', async () => {
  const result = await sendXiaoyuzhouSmsCode({
    phone: '13800138000',
    areaCode: '+86',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://podcaster-api.xiaoyuzhoufm.com/v1/auth/send-code');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.origin, 'https://podcaster.xiaoyuzhoufm.com');
      assert.deepEqual(JSON.parse(options.body), {
        mobilePhoneNumber: '13800138000',
        areaCode: '+86',
      });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: {} }),
      };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    phone: '13800138000',
    areaCode: '+86',
  });
});

test('loginXiaoyuzhouWithSms writes tokens returned in response headers', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xyz-login-'));
  const tokenPath = path.join(tempDir, 'token.json');

  const result = await loginXiaoyuzhouWithSms({
    phone: '13800138000',
    code: '123456',
    areaCode: '+86',
    tokenPath,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://podcaster-api.xiaoyuzhoufm.com/v1/auth/login-with-sms');
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), {
        areaCode: '+86',
        verifyCode: '123456',
        mobilePhoneNumber: '13800138000',
      });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name) =>
            ({
              'x-jike-access-token': 'login-access',
              'x-jike-refresh-token': 'login-refresh',
            })[name.toLowerCase()] || null,
        },
        json: async () => ({ data: { user: { uid: 'u1', nickname: '测试用户' } } }),
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.tokenPath, tokenPath);
  assert.equal(result.uid, 'u1');
  assert.equal(result.nickname, '测试用户');
  const saved = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
  assert.equal(saved.accessToken, 'login-access');
  assert.equal(saved.refreshToken, 'login-refresh');
  assert.match(saved.deviceId, /^[0-9a-f-]{36}$/i);
  assert.equal(saved.uid, 'u1');
  assert.equal(saved.nickname, '测试用户');
});
