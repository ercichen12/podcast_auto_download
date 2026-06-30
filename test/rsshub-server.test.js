import assert from 'node:assert/strict';
import test from 'node:test';
import { getRadarRules, routeDataToRss } from '../src/rsshub-server.js';

test('routeDataToRss converts RSSHub route data into RSS XML with podcast enclosure', () => {
  const xml = routeDataToRss({
    title: 'Fixture Podcast',
    link: 'https://www.xiaoyuzhoufm.com/podcast/fixture',
    description: 'A fixture feed',
    item: [
      {
        title: 'AI Episode',
        link: 'https://www.xiaoyuzhoufm.com/episode/fixture',
        pubDate: 'Mon, 29 Jun 2026 08:00:00 GMT',
        description: 'About Agent',
        enclosure_url: 'https://media.example.com/audio.mp3',
        enclosure_type: 'audio/mpeg',
      },
    ],
  });

  assert.match(xml, /<title>Fixture Podcast<\/title>/);
  assert.match(xml, /<item>/);
  assert.match(xml, /<title>AI Episode<\/title>/);
  assert.match(xml, /<enclosure url="https:\/\/media\.example\.com\/audio\.mp3" type="audio\/mpeg" \/>/);
});

test('getRadarRules returns Xiaoyuzhou rules for RSSHub-Radar refresh', () => {
  const rules = getRadarRules();

  assert.equal(rules['xiaoyuzhoufm.com']._name, '小宇宙');
  assert.deepEqual(rules['xiaoyuzhoufm.com']['.'][0].source, ['/']);
  assert.equal(rules['xiaoyuzhoufm.com']['.'][1].target, '/xiaoyuzhou/podcast/:id');
});
