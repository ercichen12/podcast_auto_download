import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { loadXiaoyuzhouCredentials, searchXiaoyuzhouEpisodes } from './xiaoyuzhou-search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(__dirname, '..');

let rssParser;

export function parseArgs(argv) {
  const result = {
    configPath: 'config/settings.json',
    dryRun: false,
    ensureRsshub: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--config') {
      result.configPath = argv[i + 1];
      i += 1;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--ensure-rsshub') {
      result.ensureRsshub = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return result;
}

export function parseXiaoyuzhouId(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const trimmed = input.trim();
  const match = trimmed.match(/xiaoyuzhoufm\.com\/(?:podcast|episode)\/([^/?#]+)/i);
  if (match) {
    return match[1];
  }

  return trimmed.replace(/^\/+|\/+$/g, '');
}

export function buildFeedUrl(feed, rsshubBaseUrl) {
  if (feed.url) {
    return feed.url;
  }

  const base = rsshubBaseUrl.replace(/\/+$/g, '');
  if (feed.rsshubPath) {
    const route = feed.rsshubPath.startsWith('/') ? feed.rsshubPath : `/${feed.rsshubPath}`;
    return `${base}${route}`;
  }

  const id = parseXiaoyuzhouId(feed.id ?? feed.xiaoyuzhouUrl);
  if (!id) {
    throw new Error(`Feed "${feed.name ?? 'unnamed'}" must define url, rsshubPath, id, or xiaoyuzhouUrl`);
  }

  return `${base}/xiaoyuzhou/podcast/${encodeURIComponent(id)}`;
}

export function findKeywordMatches(item, keywords) {
  const haystack = [
    item.title,
    item.content,
    item.contentSnippet,
    item.contentEncoded,
    item.summary,
    item.itunesSummary,
    item.creator,
    item.author,
    item.itunesAuthor,
    item.link,
    item.guid,
    Array.isArray(item.categories) ? item.categories.join(' ') : item.categories,
  ]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase();

  const matches = [];
  for (const keyword of keywords) {
    const normalized = String(keyword).trim();
    if (!normalized) {
      continue;
    }
    if (haystack.includes(normalized.toLocaleLowerCase())) {
      matches.push(normalized);
    }
  }

  return [...new Set(matches)];
}

export function getGlobalSearchKeywords(config) {
  if (!config.globalSearch?.enabled) {
    return [];
  }

  const source = Array.isArray(config.globalSearch.keywords) && config.globalSearch.keywords.length > 0
    ? config.globalSearch.keywords
    : config.keywords;

  return [...new Set(source.map((keyword) => String(keyword).trim()).filter(Boolean))];
}

export function getItemKey(item) {
  return item.guid || item.link || item.enclosure?.url || item.title;
}

export function getAudioUrl(item) {
  return item.enclosure?.url || item.enclosure?.['@_url'] || '';
}

function getDatePrefix(input) {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function getExtension(audioUrl) {
  try {
    const pathname = new URL(audioUrl).pathname;
    const ext = path.extname(pathname);
    if (ext && ext.length <= 8) {
      return ext;
    }
  } catch {
    // Keep the downloader useful for imperfect RSS data.
  }
  return '.mp3';
}

export function createSafeFilename({ publishedAt, title, extension }) {
  const date = getDatePrefix(publishedAt);
  const safeTitle = String(title || 'untitled')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);

  return `${date}_${safeTitle || 'untitled'}${extension || '.mp3'}`;
}

export function planDownloads({ feed, items, keywords, state }) {
  const downloads = [];
  let skippedAlreadyProcessed = 0;
  let skippedNoKeyword = 0;
  let skippedWithoutAudio = 0;

  for (const item of items) {
    const key = getItemKey(item);
    const keywordMatches = findKeywordMatches(item, keywords);
    if (keywordMatches.length === 0) {
      skippedNoKeyword += 1;
      continue;
    }

    if (state.items?.[key]) {
      skippedAlreadyProcessed += 1;
      continue;
    }

    const audioUrl = getAudioUrl(item);
    if (!audioUrl) {
      skippedWithoutAudio += 1;
      continue;
    }

    downloads.push({
      key,
      feedName: feed.name,
      title: item.title || key,
      originalLink: item.link || '',
      audioUrl,
      publishedAt: item.isoDate || item.pubDate || '',
      keywordMatches,
      item,
    });
  }

  return {
    downloads,
    skippedAlreadyProcessed,
    skippedNoKeyword,
    skippedWithoutAudio,
  };
}

export function resolveFromRoot(value) {
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.resolve(projectRoot, value);
}

async function readJson(filePath, fallback) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonAtomic(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

async function appendLine(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${value}\n`, 'utf8');
}

async function loadConfig(configPath) {
  const absolutePath = resolveFromRoot(configPath);
  const config = await readJson(absolutePath);
  const hasFeeds = Array.isArray(config.feeds) && config.feeds.length > 0;
  const hasGlobalSearch = config.globalSearch?.enabled === true;
  if (!hasFeeds && !hasGlobalSearch) {
    throw new Error('config.feeds must contain at least one feed, or globalSearch.enabled must be true');
  }
  if (!Array.isArray(config.keywords) || config.keywords.length === 0) {
    throw new Error('config.keywords must contain at least one keyword');
  }
  if (!Array.isArray(config.feeds)) {
    config.feeds = [];
  }
  return { config, configPath: absolutePath };
}

async function ensureDirs(config) {
  await Promise.all([
    fs.mkdir(resolveFromRoot(config.downloadDir), { recursive: true }),
    fs.mkdir(resolveFromRoot(config.dataDir), { recursive: true }),
    fs.mkdir(resolveFromRoot(config.logDir), { recursive: true }),
  ]);
}

function healthCheck(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForRsshub(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await healthCheck(baseUrl)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

export async function ensureRsshubRunning(config, log = async () => {}) {
  const baseUrl = config.rsshubBaseUrl.replace(/\/+$/g, '');
  const healthUrl = `${baseUrl}/healthz`;
  if (await healthCheck(healthUrl)) {
    await log(`RSSHub already responding at ${baseUrl}`);
    return false;
  }

  const rsshubEntry = path.resolve(projectRoot, 'src/rsshub-server.js');
  try {
    await fs.access(rsshubEntry);
  } catch {
    throw new Error('Local RSSHub wrapper is missing.');
  }

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(config.rsshub?.port ?? 1200),
    HOST: config.rsshub?.host ?? '127.0.0.1',
    NODE_OPTIONS: '--max-http-header-size=32768',
  };

  const outLog = resolveFromRoot(path.join(config.logDir, 'rsshub.out.log'));
  const errLog = resolveFromRoot(path.join(config.logDir, 'rsshub.err.log'));
  await fs.mkdir(path.dirname(outLog), { recursive: true });
  const out = await fs.open(outLog, 'a');
  const err = await fs.open(errLog, 'a');

  const child = spawn(process.execPath, [rsshubEntry], {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', out.fd, err.fd],
    env,
    windowsHide: true,
  });
  child.unref();
  await out.close();
  await err.close();
  await log(`Started RSSHub process ${child.pid}; waiting for ${baseUrl}`);

  const ready = await waitForRsshub(healthUrl, config.rsshub?.startupTimeoutMs ?? 60000);
  if (!ready) {
    throw new Error(`RSSHub did not become ready at ${baseUrl}`);
  }
  return true;
}

async function getParser() {
  if (!rssParser) {
    const { default: Parser } = await import('rss-parser');
    rssParser = new Parser({
      customFields: {
        item: [
          ['itunes:author', 'itunesAuthor'],
          ['itunes:summary', 'itunesSummary'],
          ['content:encoded', 'contentEncoded'],
        ],
      },
    });
  }
  return rssParser;
}

async function fetchFeedItems(feed, config) {
  const feedUrl = buildFeedUrl(feed, config.rsshubBaseUrl);
  const parser = await getParser();
  const parsed = await parser.parseURL(feedUrl);
  return {
    title: parsed.title,
    url: feedUrl,
    items: parsed.items.slice(0, config.maxItemsPerFeed ?? parsed.items.length),
  };
}

async function fetchGlobalSearchItems(keyword, config, credentials) {
  const globalSearch = config.globalSearch || {};
  return searchXiaoyuzhouEpisodes({
    keyword,
    limit: globalSearch.limitPerKeyword ?? 20,
    lookbackDays: globalSearch.lookbackDays ?? 7,
    credentials,
    apiBaseUrl: globalSearch.apiBaseUrl,
    log: config.__log,
  });
}

async function downloadFile(url, destination, timeoutMs) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const tempPath = `${destination}.part`;

  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath));
  await fs.rename(tempPath, destination);
}

function createLogger(config) {
  const today = new Date().toISOString().slice(0, 10);
  const logPath = resolveFromRoot(path.join(config.logDir, `${today}.log`));

  return async (message) => {
    const line = `[${new Date().toISOString()}] ${message}`;
    console.log(line);
    await appendLine(logPath, line);
  };
}

export async function runDownloader(options) {
  const { config } = await loadConfig(options.configPath);
  await ensureDirs(config);
  const log = createLogger(config);
  config.__log = log;

  await log(`Starting Xiaoyuzhou AI podcast downloader${options.dryRun ? ' in dry-run mode' : ''}`);
  if (options.ensureRsshub) {
    await ensureRsshubRunning(config, log);
  }

  const statePath = resolveFromRoot(path.join(config.dataDir, 'state.json'));
  const recordsPath = resolveFromRoot(path.join(config.dataDir, 'records.jsonl'));
  const state = await readJson(statePath, { items: {} });

  const summary = {
    feeds: 0,
    globalSearches: 0,
    matched: 0,
    downloaded: 0,
    skippedAlreadyProcessed: 0,
    skippedNoKeyword: 0,
    skippedWithoutAudio: 0,
    skippedOldSearchResults: 0,
    skippedGlobalSearchNoAuth: 0,
    errors: 0,
  };

  for (const feed of config.feeds) {
    summary.feeds += 1;
    try {
      const parsed = await fetchFeedItems(feed, config);
      await log(`Fetched ${parsed.items.length} item(s) from ${feed.name ?? parsed.title ?? parsed.url}`);
      const plan = planDownloads({ feed, items: parsed.items, keywords: config.keywords, state });
      summary.matched += plan.downloads.length;
      summary.skippedAlreadyProcessed += plan.skippedAlreadyProcessed;
      summary.skippedNoKeyword += plan.skippedNoKeyword;
      summary.skippedWithoutAudio += plan.skippedWithoutAudio;

      for (const item of plan.downloads) {
        const extension = getExtension(item.audioUrl);
        const filename = createSafeFilename({
          publishedAt: item.publishedAt,
          title: item.title,
          extension,
        });
        const destination = resolveFromRoot(path.join(config.downloadDir, filename));
        const record = {
          podcastName: item.feedName || parsed.title || '',
          episodeTitle: item.title,
          publishedAt: item.publishedAt,
          originalLink: item.originalLink,
          audioUrl: item.audioUrl,
          matchedKeywords: item.keywordMatches,
          downloadedAt: new Date().toISOString(),
          localPath: destination,
          dryRun: options.dryRun,
        };

        if (options.dryRun) {
          await log(`[dry-run] Would download: ${item.title} -> ${destination}`);
        } else {
          await log(`Downloading: ${item.title}`);
          await downloadFile(item.audioUrl, destination, config.downloadTimeoutMs ?? 180000);
          await appendLine(recordsPath, JSON.stringify(record));
          summary.downloaded += 1;
          await log(`Downloaded: ${destination}`);
        }

        state.items[item.key] = record;
      }
    } catch (error) {
      summary.errors += 1;
      await log(`ERROR feed "${feed.name ?? 'unnamed'}": ${error.stack || error.message}`);
    }
  }

  const searchKeywords = getGlobalSearchKeywords(config);
  if (searchKeywords.length > 0) {
    const credentials = await loadXiaoyuzhouCredentials({ tokenPath: config.globalSearch?.tokenPath });
    await log(
      `Global search auth state: tokenFile=${credentials.tokenPath} exists=${credentials.exists ? 'yes' : 'no'} accessToken=${
        credentials.accessToken ? 'present' : 'missing'
      } refreshToken=${credentials.refreshToken ? 'present' : 'missing'} deviceId=${
        credentials.deviceId ? 'present' : 'missing'
      }`
    );
    if (!credentials.accessToken) {
      summary.skippedGlobalSearchNoAuth += searchKeywords.length;
      await log(
        `Skipping Xiaoyuzhou global search: missing accessToken in ${credentials.tokenPath}. Fixed RSS feeds are unaffected.`
      );
    } else {
      for (const keyword of searchKeywords) {
        summary.globalSearches += 1;
        try {
          await log(`Global search keyword start: "${keyword}"`);
          const parsed = await fetchGlobalSearchItems(keyword, config, credentials);
          summary.skippedOldSearchResults += parsed.skippedOld;
          await log(
            `Fetched ${parsed.items.length} global Xiaoyuzhou search item(s) for "${keyword}"` +
              (parsed.skippedOld ? `; skipped ${parsed.skippedOld} old result(s)` : '') +
              `; received ${parsed.receivedCount ?? parsed.items.length} result(s) total`
          );
          await log(`Global search keyword plan: "${keyword}" evaluating ${parsed.items.length} item(s)`);
          const feed = { name: `小宇宙全局搜索: ${keyword}` };
          const plan = planDownloads({ feed, items: parsed.items, keywords: config.keywords, state });
          summary.matched += plan.downloads.length;
          summary.skippedAlreadyProcessed += plan.skippedAlreadyProcessed;
          summary.skippedNoKeyword += plan.skippedNoKeyword;
          summary.skippedWithoutAudio += plan.skippedWithoutAudio;
          await log(
            `Global search keyword plan result: "${keyword}" matches=${plan.downloads.length} skippedAlreadyProcessed=${plan.skippedAlreadyProcessed} skippedNoKeyword=${plan.skippedNoKeyword} skippedWithoutAudio=${plan.skippedWithoutAudio}`
          );

          for (const item of plan.downloads) {
            const extension = getExtension(item.audioUrl);
            const filename = createSafeFilename({
              publishedAt: item.publishedAt,
              title: item.title,
              extension,
            });
            const destination = resolveFromRoot(path.join(config.downloadDir, filename));
            const record = {
              podcastName: item.feedName,
              episodeTitle: item.title,
              publishedAt: item.publishedAt,
              originalLink: item.originalLink,
              audioUrl: item.audioUrl,
              matchedKeywords: item.keywordMatches,
              source: 'xiaoyuzhou-global-search',
              searchKeyword: keyword,
              downloadedAt: new Date().toISOString(),
              localPath: destination,
              dryRun: options.dryRun,
            };

            if (options.dryRun) {
              await log(`[dry-run] Would download global search result: ${item.title} -> ${destination}`);
            } else {
              await log(`Downloading global search result: ${item.title} -> ${destination}`);
              await downloadFile(item.audioUrl, destination, config.downloadTimeoutMs ?? 180000);
              await log(`Download finished: ${item.title} -> ${destination}`);
              await appendLine(recordsPath, JSON.stringify(record));
              await log(`Record appended: ${path.basename(recordsPath)} for ${item.key}`);
              summary.downloaded += 1;
              await log(`Downloaded: ${destination}`);
            }

            state.items[item.key] = record;
          }
        } catch (error) {
          summary.errors += 1;
          await log(`ERROR global search "${keyword}": ${error.stack || error.message}`);
        }
      }
    }
  }

  if (!options.dryRun) {
    await writeJsonAtomic(statePath, state);
    await log(`State written: ${statePath}`);
  }

  await log(`Finished: ${JSON.stringify(summary)}`);
  return summary;
}

function printHelp() {
  console.log(`Usage: node src/downloader.js [--config config/settings.json] [--dry-run] [--ensure-rsshub]

Options:
  --config <path>     Config JSON path. Defaults to config/settings.json.
  --dry-run           Fetch and filter feeds without downloading audio.
  --ensure-rsshub     Start local RSSHub if localhost is not responding.
`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      process.exitCode = 0;
    } else {
      const summary = await runDownloader(options);
      process.exitCode = summary.errors > 0 ? 1 : 0;
    }
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}
