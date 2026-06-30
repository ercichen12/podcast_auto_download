import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const XIAOYUZHOU_API_BASE = 'https://api.xiaoyuzhoufm.com';
export const XIAOYUZHOU_PODCASTER_API_BASE = 'https://podcaster-api.xiaoyuzhoufm.com';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function formatLocalTime(now = new Date()) {
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(
    now.getMinutes()
  )}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}+0800`;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value) {
  return String(value || '').trim();
}

function resolveFromRoot(value) {
  if (!value) {
    return '';
  }
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.resolve(projectRoot, value);
}

export function buildSearchRequest(keyword, limit) {
  return {
    path: '/v1/search/create',
    payload: {
      keyword: String(keyword || '').trim(),
      type: 'EPISODE',
      limit: String(limit),
      sourcePageName: '4',
      currentPageName: '4',
    },
  };
}

export function createXiaoyuzhouHeaders({ accessToken, deviceId, refreshToken, now } = {}) {
  const headers = {
    Host: 'api.xiaoyuzhoufm.com',
    os: 'android',
    'os-version': '28',
    manufacturer: 'Xiaomi',
    model: 'MI 6',
    resolution: '1080x1920',
    market: 'xiaomi',
    applicationid: 'app.podcast.cosmos',
    'app-version': '2.99.1',
    'app-buildno': '1362',
    webviewversion: '138.0.7204.179',
    'User-Agent': 'Xiaoyuzhou/2.99.1(android 28)',
    'app-permissions': '100100',
    wificonnected: 'false',
    timezone: 'Asia/Shanghai',
    'local-time': formatLocalTime(now),
    'content-type': 'application/json;charset=utf-8',
    'Accept-Encoding': 'gzip',
  };

  if (accessToken) {
    headers['x-jike-access-token'] = accessToken;
  }
  if (refreshToken) {
    headers['x-jike-refresh-token'] = refreshToken;
  }
  if (deviceId) {
    headers['x-jike-device-id'] = deviceId;
  }

  return headers;
}

function createPodcasterHeaders() {
  return {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json;charset=UTF-8',
    origin: 'https://podcaster.xiaoyuzhoufm.com',
    referer: 'https://podcaster.xiaoyuzhoufm.com/',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  };
}

export function normalizeSearchEpisode(episode, keyword) {
  const media = episode?.media || {};
  const mediaSource = media.source || {};
  const enclosure = episode?.enclosure || {};
  const podcast = episode?.podcast || {};
  const eid = compact(episode?.eid);
  const title = compact(episode?.title) || eid || 'untitled';
  const shownotes = stripHtml(episode?.shownotes || episode?.description || episode?.summary);
  const podcastTitle = compact(podcast.title);
  const author = compact(podcast.author || episode?.author);
  const audioUrl = compact(mediaSource.url || enclosure.url || episode?.audioUrl || episode?.audio_url);
  const pubDate = compact(episode?.pubDate || episode?.pub_date || episode?.publishedAt);
  const link = eid ? `https://www.xiaoyuzhoufm.com/episode/${encodeURIComponent(eid)}` : compact(episode?.link);

  return {
    guid: eid ? `xiaoyuzhou:episode:${eid}` : link || audioUrl || title,
    title,
    link,
    pubDate,
    isoDate: pubDate,
    creator: podcastTitle || author,
    author,
    contentSnippet: [podcastTitle, author, shownotes].filter(Boolean).join('\n'),
    content: shownotes,
    summary: shownotes,
    categories: ['xiaoyuzhou-global-search', String(keyword || '').trim()].filter(Boolean),
    enclosure: audioUrl ? { url: audioUrl, type: enclosure.type || 'audio/mpeg' } : undefined,
    xiaoyuzhou: {
      eid: eid || undefined,
      pid: compact(podcast.pid) || undefined,
      podcastTitle: podcastTitle || undefined,
      matchedSearchKeyword: String(keyword || '').trim() || undefined,
    },
  };
}

export function isWithinLookbackDays(dateValue, lookbackDays, now = new Date()) {
  if (!lookbackDays || lookbackDays <= 0) {
    return true;
  }
  const published = new Date(dateValue);
  if (Number.isNaN(published.getTime())) {
    return false;
  }
  const maxAgeMs = lookbackDays * 24 * 60 * 60 * 1000;
  return published.getTime() >= now.getTime() - maxAgeMs && published.getTime() <= now.getTime() + 5 * 60 * 1000;
}

export async function loadXiaoyuzhouCredentials({ tokenPath } = {}) {
  const resolvedTokenPath = resolveFromRoot(tokenPath || 'config/xiaoyuzhou-token.json');
  try {
    const raw = await fs.readFile(resolvedTokenPath, 'utf8');
    const data = JSON.parse(raw);
    return {
      exists: true,
      accessToken: data.accessToken || data.access_token || data['x-jike-access-token'] || '',
      refreshToken: data.refreshToken || data.refresh_token || data['x-jike-refresh-token'] || '',
      deviceId: data.deviceId || data.device_id || data['x-jike-device-id'] || '',
      uid: data.uid || '',
      nickname: data.nickname || '',
      tokenPath: resolvedTokenPath,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        exists: false,
        accessToken: '',
        refreshToken: '',
        deviceId: '',
        uid: '',
        nickname: '',
        tokenPath: resolvedTokenPath,
      };
    }
    throw error;
  }
}

async function saveXiaoyuzhouCredentials(credentials) {
  if (!credentials.tokenPath) {
    return;
  }
  await fs.mkdir(path.dirname(credentials.tokenPath), { recursive: true });
  await fs.writeFile(
    credentials.tokenPath,
    `${JSON.stringify(
      {
        accessToken: credentials.accessToken || '',
        refreshToken: credentials.refreshToken || '',
        deviceId: credentials.deviceId || '',
        uid: credentials.uid || '',
        nickname: credentials.nickname || '',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function getResponseHeader(response, name) {
  if (!response?.headers?.get) {
    return '';
  }
  return response.headers.get(name) || response.headers.get(name.toLowerCase()) || response.headers.get(name.toUpperCase()) || '';
}

export async function sendXiaoyuzhouSmsCode({
  phone,
  areaCode = '+86',
  apiBaseUrl = XIAOYUZHOU_PODCASTER_API_BASE,
  fetchImpl = fetch,
  log = async () => {},
} = {}) {
  const normalizedPhone = String(phone || '').trim();
  const normalizedAreaCode = String(areaCode || '+86').trim();
  if (!normalizedPhone) {
    throw new Error('phone is required');
  }

  await log(
    `[xiaoyuzhou-auth] send-code start phone=${normalizedPhone} areaCode=${normalizedAreaCode} apiBaseUrl=${apiBaseUrl}`
  );

  const response = await fetchImpl(`${String(apiBaseUrl).replace(/\/+$/g, '')}/v1/auth/send-code`, {
    method: 'POST',
    headers: createPodcasterHeaders(),
    body: JSON.stringify({
      mobilePhoneNumber: normalizedPhone,
      areaCode: normalizedAreaCode,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Xiaoyuzhou send-code failed: HTTP ${response.status} ${response.statusText}`);
  }

  await log(
    `[xiaoyuzhou-auth] send-code accepted phone=${normalizedPhone} areaCode=${normalizedAreaCode}`
  );

  return {
    ok: true,
    phone: normalizedPhone,
    areaCode: normalizedAreaCode,
  };
}

export async function loginXiaoyuzhouWithSms({
  phone,
  code,
  areaCode = '+86',
  tokenPath = 'config/xiaoyuzhou-token.json',
  apiBaseUrl = XIAOYUZHOU_PODCASTER_API_BASE,
  fetchImpl = fetch,
  log = async () => {},
} = {}) {
  const normalizedPhone = String(phone || '').trim();
  const normalizedCode = String(code || '').trim();
  const normalizedAreaCode = String(areaCode || '+86').trim();
  if (!normalizedPhone) {
    throw new Error('phone is required');
  }
  if (!normalizedCode) {
    throw new Error('code is required');
  }

  const resolvedTokenPath = resolveFromRoot(tokenPath);
  await log(
    `[xiaoyuzhou-auth] login start phone=${normalizedPhone} areaCode=${normalizedAreaCode} tokenPath=${resolvedTokenPath}`
  );

  const response = await fetchImpl(`${String(apiBaseUrl).replace(/\/+$/g, '')}/v1/auth/login-with-sms`, {
    method: 'POST',
    headers: createPodcasterHeaders(),
    body: JSON.stringify({
      areaCode: normalizedAreaCode,
      verifyCode: normalizedCode,
      mobilePhoneNumber: normalizedPhone,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Xiaoyuzhou login-with-sms failed: HTTP ${response.status} ${response.statusText}`);
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  const accessToken = getResponseHeader(response, 'x-jike-access-token') || body['x-jike-access-token'] || body.accessToken;
  const refreshToken = getResponseHeader(response, 'x-jike-refresh-token') || body['x-jike-refresh-token'] || body.refreshToken;
  if (!accessToken || !refreshToken) {
    throw new Error('Xiaoyuzhou login succeeded but token headers are missing');
  }

  const user = body?.data?.user || {};
  const credentials = {
    accessToken,
    refreshToken,
    deviceId: randomUUID(),
    uid: user.uid || '',
    nickname: user.nickname || '',
    tokenPath: resolvedTokenPath,
  };
  await saveXiaoyuzhouCredentials(credentials);

  await log(
    `[xiaoyuzhou-auth] login success tokenPath=${resolvedTokenPath} account=${credentials.nickname || credentials.uid || 'unknown'} accessToken=present refreshToken=present deviceId=present`
  );

  return {
    ok: true,
    uid: credentials.uid,
    nickname: credentials.nickname,
    tokenPath: credentials.tokenPath,
  };
}

export async function refreshXiaoyuzhouAccessToken({
  credentials,
  apiBaseUrl = XIAOYUZHOU_API_BASE,
  now = new Date(),
  fetchImpl = fetch,
  log = async () => {},
} = {}) {
  if (!credentials?.refreshToken) {
    throw new Error('Xiaoyuzhou token refresh requires refreshToken');
  }

  await log(
    `[xiaoyuzhou-search] refresh start tokenPath=${credentials.tokenPath || '<memory>'} deviceId=${credentials.deviceId ? 'present' : 'missing'}`
  );

  const response = await fetchImpl(`${String(apiBaseUrl).replace(/\/+$/g, '')}/app_auth_tokens.refresh`, {
    method: 'POST',
    headers: createXiaoyuzhouHeaders({
      refreshToken: credentials.refreshToken,
      deviceId: credentials.deviceId,
      now,
    }),
    body: '',
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Xiaoyuzhou token refresh failed: HTTP ${response.status} ${response.statusText || ''}`.trim());
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  const accessToken = getResponseHeader(response, 'x-jike-access-token') || body['x-jike-access-token'] || body.accessToken;
  const refreshToken =
    getResponseHeader(response, 'x-jike-refresh-token') || body['x-jike-refresh-token'] || body.refreshToken || credentials.refreshToken;

  if (!accessToken) {
    throw new Error('Xiaoyuzhou token refresh failed: missing x-jike-access-token');
  }

  const refreshed = {
    ...credentials,
    accessToken,
    refreshToken,
  };
  await saveXiaoyuzhouCredentials(refreshed);
  await log(
    `[xiaoyuzhou-search] refresh saved tokenPath=${refreshed.tokenPath || '<memory>'} accessToken=present refreshToken=present`
  );
  return refreshed;
}

export async function searchXiaoyuzhouEpisodes({
  keyword,
  limit = 20,
  lookbackDays = 7,
  credentials = {},
  apiBaseUrl = XIAOYUZHOU_API_BASE,
  now = new Date(),
  fetchImpl = fetch,
  log = async () => {},
} = {}) {
  const normalizedKeyword = String(keyword || '').trim();
  if (!normalizedKeyword) {
    return { keyword: normalizedKeyword, items: [], skippedOld: 0, receivedCount: 0, processedCount: 0 };
  }
  if (!credentials.accessToken) {
    throw new Error('Xiaoyuzhou global search requires accessToken');
  }

  await log(
    `[xiaoyuzhou-search] search start keyword="${normalizedKeyword}" limit=${limit} lookbackDays=${lookbackDays} apiBaseUrl=${apiBaseUrl}`
  );

  const { path: requestPath, payload } = buildSearchRequest(normalizedKeyword, limit);
  const doSearch = (activeCredentials) =>
    fetchImpl(`${String(apiBaseUrl).replace(/\/+$/g, '')}${requestPath}`, {
      method: 'POST',
      headers: createXiaoyuzhouHeaders({
        accessToken: activeCredentials.accessToken,
        deviceId: activeCredentials.deviceId,
        now,
      }),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

  let response = await doSearch(credentials);
  if (response.status === 401 && credentials.refreshToken) {
    await log(`[xiaoyuzhou-search] search 401 keyword="${normalizedKeyword}" refreshing access token`);
    const refreshed = await refreshXiaoyuzhouAccessToken({
      credentials,
      apiBaseUrl,
      now,
      fetchImpl,
      log,
    });
    response = await doSearch(refreshed);
  }

  if (!response.ok) {
    throw new Error(`Xiaoyuzhou search failed: HTTP ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const receivedCount = Array.isArray(body.data) ? body.data.length : 0;
  const rawItems = Array.isArray(body.data) ? body.data.slice(0, limit) : [];
  let skippedOld = 0;
  const items = [];
  for (const rawItem of rawItems) {
    const normalized = normalizeSearchEpisode(rawItem, normalizedKeyword);
    if (!isWithinLookbackDays(normalized.pubDate || normalized.isoDate, lookbackDays, now)) {
      skippedOld += 1;
      continue;
    }
    items.push(normalized);
  }

  await log(
    `[xiaoyuzhou-search] search response keyword="${normalizedKeyword}" received=${receivedCount} processed=${rawItems.length} kept=${items.length} skippedOld=${skippedOld}`
  );

  return {
    keyword: normalizedKeyword,
    items,
    skippedOld,
    receivedCount,
    processedCount: rawItems.length,
  };
}
