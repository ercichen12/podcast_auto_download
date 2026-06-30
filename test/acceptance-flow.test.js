import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { runDownloader } from '../src/downloader.js';

function startFixtureServer() {
  const audio = Buffer.from('fixture-audio-for-ai-podcast');
  let server;

  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (req.url === '/feed.xml') {
        res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
        res.end(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture Xiaoyuzhou</title>
    <item>
      <guid>fixture-ai-episode</guid>
      <title>AI Agent 测试节目</title>
      <link>${origin}/episode/fixture-ai-episode</link>
      <pubDate>Mon, 29 Jun 2026 08:00:00 GMT</pubDate>
      <description>聊聊大模型和智能体。</description>
      <enclosure url="${origin}/audio.mp3" length="${audio.length}" type="audio/mpeg" />
    </item>
    <item>
      <guid>fixture-normal-episode</guid>
      <title>普通测试节目</title>
      <link>${origin}/episode/fixture-normal-episode</link>
      <pubDate>Mon, 29 Jun 2026 09:00:00 GMT</pubDate>
      <description>没有关键词。</description>
      <enclosure url="${origin}/normal.mp3" length="${audio.length}" type="audio/mpeg" />
    </item>
  </channel>
</rss>`);
      } else if (req.url === '/audio.mp3') {
        res.writeHead(200, { 'content-type': 'audio/mpeg' });
        res.end(audio);
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    });

    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, audio }));
  });
}

const { server, port, audio } = await startFixtureServer();
try {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rsshub-ai-flow-'));
  const configPath = path.join(tempDir, 'settings.json');
  const config = {
    rsshubBaseUrl: `http://127.0.0.1:${port}`,
    downloadDir: path.join(tempDir, 'downloads'),
    dataDir: path.join(tempDir, 'data'),
    logDir: path.join(tempDir, 'logs'),
    feeds: [{ name: 'fixture', url: `http://127.0.0.1:${port}/feed.xml` }],
    globalSearch: {
      enabled: true,
      tokenPath: path.join(tempDir, 'missing-token.json'),
      keywords: ['AI'],
      limitPerKeyword: 5,
      lookbackDays: 7,
    },
    keywords: ['AI', 'Agent', '大模型', '智能体'],
    maxItemsPerFeed: 10,
    downloadTimeoutMs: 10000,
  };
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  const first = await runDownloader({ configPath, dryRun: false, ensureRsshub: false });
  assert.equal(first.errors, 0);
  assert.equal(first.downloaded, 1);
  assert.equal(first.skippedGlobalSearchNoAuth, 1);

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
