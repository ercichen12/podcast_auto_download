import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { runDownloader } from '../src/downloader.js';

function startFixtureServer() {
  const audio = Buffer.from('fixture-audio-from-global-search');
  const searchRequests = [];
  let server;

  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (req.url === '/v1/search/create' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          searchRequests.push(JSON.parse(body));
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              data: [
                {
                  eid: 'search-ai-episode',
                  title: 'AI Agent 全局搜索节目',
                  shownotes: '这一期聊大模型和智能体。',
                  pubDate: '2026-06-29T08:00:00.000Z',
                  media: { source: { url: `${origin}/audio.mp3` } },
                  podcast: { pid: 'search-podcast', title: '全局科技播客' },
                },
                {
                  eid: 'search-old-episode',
                  title: 'AI 旧节目',
                  shownotes: '很旧的一期。',
                  pubDate: '2026-01-01T08:00:00.000Z',
                  media: { source: { url: `${origin}/old.mp3` } },
                  podcast: { pid: 'old-podcast', title: '旧播客' },
                },
              ],
            })
          );
        });
      } else if (req.url === '/audio.mp3') {
        res.writeHead(200, { 'content-type': 'audio/mpeg' });
        res.end(audio);
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    });

    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, audio, searchRequests }));
  });
}

const { server, port, audio, searchRequests } = await startFixtureServer();
try {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rsshub-global-search-flow-'));
  const configPath = path.join(tempDir, 'settings.json');
  const tokenPath = path.join(tempDir, 'xiaoyuzhou-token.json');
  await fs.writeFile(
    tokenPath,
    JSON.stringify({
      accessToken: 'access',
      deviceId: 'device',
    }),
    'utf8'
  );

  const config = {
    rsshubBaseUrl: `http://127.0.0.1:${port}`,
    downloadDir: path.join(tempDir, 'downloads'),
    dataDir: path.join(tempDir, 'data'),
    logDir: path.join(tempDir, 'logs'),
    feeds: [],
    keywords: ['AI', 'Agent', '大模型', '智能体'],
    globalSearch: {
      enabled: true,
      apiBaseUrl: `http://127.0.0.1:${port}`,
      tokenPath,
      keywords: ['AI'],
      limitPerKeyword: 5,
      lookbackDays: 7,
    },
    maxItemsPerFeed: 10,
    downloadTimeoutMs: 10000,
  };
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  const first = await runDownloader({ configPath, dryRun: false, ensureRsshub: false });
  assert.equal(first.errors, 0);
  assert.equal(first.globalSearches, 1);
  assert.equal(first.downloaded, 1);
  assert.equal(first.skippedOldSearchResults, 1);
  assert.equal(searchRequests[0].keyword, 'AI');

  const files = await fs.readdir(config.downloadDir);
  assert.equal(files.length, 1);
  const downloaded = await fs.readFile(path.join(config.downloadDir, files[0]));
  assert.deepEqual(downloaded, audio);

  const second = await runDownloader({ configPath, dryRun: false, ensureRsshub: false });
  assert.equal(second.errors, 0);
  assert.equal(second.downloaded, 0);
  assert.equal(second.skippedAlreadyProcessed, 1);
} finally {
  server.close();
}
