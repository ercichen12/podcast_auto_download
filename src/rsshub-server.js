import http from 'node:http';
import { init, request } from 'rsshub';

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function getRadarRules() {
  return {
    'xiaoyuzhoufm.com': {
      _name: '小宇宙',
      '.': [
        {
          title: '编辑精选',
          docs: 'https://docs.rsshub.app/routes/multimedia',
          source: ['/'],
          target: '/xiaoyuzhou/',
        },
        {
          title: '播客',
          docs: 'https://docs.rsshub.app/routes/multimedia',
          source: ['/podcast/:id', '/episode/:id'],
          target: '/xiaoyuzhou/podcast/:id',
        },
      ],
    },
  };
}

function itemToRss(item) {
  const parts = [
    '<item>',
    `<title>${escapeXml(item.title)}</title>`,
    item.link ? `<link>${escapeXml(item.link)}</link>` : '',
    item.guid ? `<guid>${escapeXml(item.guid)}</guid>` : item.link ? `<guid>${escapeXml(item.link)}</guid>` : '',
    item.pubDate ? `<pubDate>${escapeXml(item.pubDate)}</pubDate>` : '',
    item.author ? `<author>${escapeXml(item.author)}</author>` : '',
    item.description ? `<description><![CDATA[${String(item.description).replaceAll(']]>', ']]&gt;')}]]></description>` : '',
  ];

  if (item.enclosure_url) {
    const type = item.enclosure_type || 'audio/mpeg';
    const length = item.enclosure_length ? ` length="${escapeXml(item.enclosure_length)}"` : '';
    parts.push(`<enclosure url="${escapeXml(item.enclosure_url)}" type="${escapeXml(type)}"${length} />`);
  }

  parts.push('</item>');
  return parts.filter(Boolean).join('');
}

export function routeDataToRss(data) {
  const items = Array.isArray(data.item) ? data.item : [];
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(data.title || 'RSSHub')}</title>
    ${data.link ? `<link>${escapeXml(data.link)}</link>` : ''}
    ${data.description ? `<description><![CDATA[${String(data.description).replaceAll(']]>', ']]&gt;')}]]></description>` : ''}
    ${data.lastBuildDate ? `<lastBuildDate>${escapeXml(data.lastBuildDate)}</lastBuildDate>` : ''}
    ${data.itunes_author ? `<itunes:author>${escapeXml(data.itunes_author)}</itunes:author>` : ''}
    ${items.map(itemToRss).join('\n    ')}
  </channel>
</rss>`;
}

export async function createServer() {
  await init({});

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'content-type',
      };
      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }
      if (url.pathname === '/healthz') {
        res.writeHead(200, { ...corsHeaders, 'content-type': 'text/plain; charset=utf-8' });
        res.end('ok');
        return;
      }
      if (url.pathname === '/api/radar/rules') {
        res.writeHead(200, { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(getRadarRules()));
        return;
      }

      const data = await request(`${url.pathname}${url.search}`);
      if (data?.error) {
        res.writeHead(503, { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
        return;
      }

      res.writeHead(200, { ...corsHeaders, 'content-type': 'application/rss+xml; charset=utf-8' });
      res.end(routeDataToRss(data));
    } catch (error) {
      res.writeHead(500, { 'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

if (process.argv[1] && process.argv[1].endsWith('rsshub-server.js')) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 1200);
  const server = await createServer();
  server.listen(port, host, () => {
    console.log(`Local RSSHub wrapper listening at http://${host}:${port}`);
  });
}
