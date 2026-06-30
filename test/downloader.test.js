import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFeedUrl,
  createSafeFilename,
  findKeywordMatches,
  getGlobalSearchKeywords,
  getItemKey,
  parseArgs,
  parseXiaoyuzhouId,
  planDownloads,
} from '../src/downloader.js';

test('parseXiaoyuzhouId extracts podcast and episode ids from URLs', () => {
  assert.equal(
    parseXiaoyuzhouId('https://www.xiaoyuzhoufm.com/podcast/6021f949a789fca4eff4492c'),
    '6021f949a789fca4eff4492c'
  );
  assert.equal(
    parseXiaoyuzhouId('https://www.xiaoyuzhoufm.com/episode/6714dc9cdb2cf827578d4c9e?utm_source=share'),
    '6714dc9cdb2cf827578d4c9e'
  );
  assert.equal(parseXiaoyuzhouId('6021f949a789fca4eff4492c'), '6021f949a789fca4eff4492c');
});

test('buildFeedUrl supports RSSHub paths, podcast ids, and full RSS URLs', () => {
  const base = 'http://127.0.0.1:1200/';

  assert.equal(buildFeedUrl({ rsshubPath: '/xiaoyuzhou' }, base), 'http://127.0.0.1:1200/xiaoyuzhou');
  assert.equal(
    buildFeedUrl({ id: '6021f949a789fca4eff4492c' }, base),
    'http://127.0.0.1:1200/xiaoyuzhou/podcast/6021f949a789fca4eff4492c'
  );
  assert.equal(buildFeedUrl({ url: 'https://example.com/feed.xml' }, base), 'https://example.com/feed.xml');
});

test('findKeywordMatches detects Chinese terms and English acronyms case-insensitively', () => {
  const item = {
    title: '聊聊 Claude 和智能体',
    contentSnippet: '这一期讨论 llm、RAG 与产品落地。',
  };

  assert.deepEqual(findKeywordMatches(item, ['AI', 'Claude', '智能体', 'LLM', 'RAG']), [
    'Claude',
    '智能体',
    'LLM',
    'RAG',
  ]);
});

test('getItemKey prefers stable identifiers before enclosure urls', () => {
  assert.equal(getItemKey({ guid: 'guid-1', link: 'https://item', enclosure: { url: 'https://audio' } }), 'guid-1');
  assert.equal(getItemKey({ link: 'https://item', enclosure: { url: 'https://audio' } }), 'https://item');
  assert.equal(getItemKey({ enclosure: { url: 'https://audio' } }), 'https://audio');
});

test('createSafeFilename keeps readable title text and removes unsafe path characters', () => {
  const name = createSafeFilename({
    publishedAt: '2026-06-29T08:00:00.000Z',
    title: 'AI/Agent: 今天聊什么?',
    extension: '.mp3',
  });

  assert.equal(name, '2026-06-29_AI_Agent_今天聊什么.mp3');
});

test('planDownloads filters matches and skips previously processed items', () => {
  const feed = { name: '测试播客' };
  const state = { items: { old: { downloadedAt: '2026-06-28T00:00:00.000Z' } } };
  const items = [
    { guid: 'old', title: 'OpenAI 旧节目', enclosure: { url: 'https://cdn.example.com/old.mp3' } },
    { guid: 'new', title: 'AI 新节目', enclosure: { url: 'https://cdn.example.com/new.mp3' } },
    { guid: 'no-audio', title: 'AI 没有音频' },
    { guid: 'miss', title: '普通节目', enclosure: { url: 'https://cdn.example.com/miss.mp3' } },
  ];

  const result = planDownloads({ feed, items, keywords: ['AI', 'OpenAI'], state });

  assert.equal(result.downloads.length, 1);
  assert.equal(result.downloads[0].key, 'new');
  assert.equal(result.skippedAlreadyProcessed, 1);
  assert.equal(result.skippedWithoutAudio, 1);
  assert.equal(result.skippedNoKeyword, 1);
});

test('parseArgs reads config path and dry-run flag', () => {
  assert.deepEqual(parseArgs(['--config', 'config/test.json', '--dry-run']), {
    configPath: 'config/test.json',
    dryRun: true,
    ensureRsshub: false,
  });
});

test('getGlobalSearchKeywords prefers dedicated search keywords and falls back to main keywords', () => {
  assert.deepEqual(
    getGlobalSearchKeywords({
      keywords: ['AI', 'OpenAI'],
      globalSearch: { enabled: true, keywords: ['Claude', 'Agent', 'Claude'] },
    }),
    ['Claude', 'Agent']
  );

  assert.deepEqual(
    getGlobalSearchKeywords({
      keywords: ['AI', 'OpenAI'],
      globalSearch: { enabled: true },
    }),
    ['AI', 'OpenAI']
  );

  assert.deepEqual(
    getGlobalSearchKeywords({
      keywords: ['AI'],
      globalSearch: { enabled: false, keywords: ['Claude'] },
    }),
    []
  );
});
