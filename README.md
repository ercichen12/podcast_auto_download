# RSSHub-Radar + Xiaoyuzhou AI Podcast Downloader

This local setup has three parts:

1. RSSHub-Radar: browser extension for discovering RSS/RSSHub routes on pages.
2. RSSHub: local RSSHub service at `http://127.0.0.1:1200`.
3. Downloader: daily script that fetches configured Xiaoyuzhou feeds, filters AI keywords, downloads matching audio, and records state.
4. Xiaoyuzhou global search: optional authenticated API search that finds matching episodes outside the configured podcasts.

## Install

```powershell
npm install --no-audit
powershell -ExecutionPolicy Bypass -File .\scripts\install-radar.ps1
```

Load the unpacked extension directory:

```text
F:\vibe\rsshub\tools\rsshub-radar\chrome-mv3-prod
```

In RSSHub-Radar options, set the RSSHub instance to:

```text
http://127.0.0.1:1200
```

## Run Once

```powershell
npm run download:dry-run
npm run download
```

The downloader starts local RSSHub automatically when needed.

## Xiaoyuzhou Global Search

Global search is enabled in `config/settings.json` under `globalSearch`. It searches Xiaoyuzhou episodes once per configured keyword, takes `limitPerKeyword` results, keeps results within `lookbackDays`, then sends them through the same keyword matching, download, record, and dedupe flow as fixed RSS feeds.

This is separate from RSSHub-Radar. RSSHub-Radar discovers routes on pages you visit; Xiaoyuzhou global search uses Xiaoyuzhou app-compatible API calls and needs a local token file.

Use SMS login to create the local token file:

```powershell
npm run xiaoyuzhou:send-code -- --phone 13800138000
npm run xiaoyuzhou:login -- --phone 13800138000 --code 123456
```

The login command writes:

```text
F:\vibe\rsshub\config\xiaoyuzhou-token.json
```

Format:

```json
{
  "accessToken": "x-jike-access-token",
  "refreshToken": "x-jike-refresh-token",
  "deviceId": "x-jike-device-id"
}
```

`config/xiaoyuzhou-token.json` is ignored by git. If the file is missing or `accessToken` is empty, global search is skipped and the fixed RSS feed downloader still runs.

If Xiaoyuzhou returns 401 and `refreshToken` is present, the downloader refreshes once, writes the rotated token back to the same file, and retries the search.

The downloader log now shows auth state, each keyword search start, search result counts, plan counts, download start/finish, record append, and state write, so you can trace one run end to end.

## Daily Task

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-daily-task.ps1
```

Default schedule: every day at `09:00`.

## Add Xiaoyuzhou Feeds

Use RSSHub-Radar on a Xiaoyuzhou podcast page to find/copy the route, then edit `config/settings.json`.

Examples:

```json
{
  "name": "Example Xiaoyuzhou Podcast",
  "id": "6021f949a789fca4eff4492c"
}
```

```json
{
  "name": "Example Xiaoyuzhou Podcast",
  "rsshubPath": "/xiaoyuzhou/podcast/6021f949a789fca4eff4492c"
}
```

The default config starts with three Xiaoyuzhou AI-related podcasts:

- AI 炼金术
- AI Odyssey
- 从零开始用AI

Each run checks the latest 5 items per feed by default. Increase `maxItemsPerFeed` if you want a larger first backfill.

The global search defaults to 21 AI keywords, 20 results per keyword, and a 7-day lookback window.

## Output

- `downloads/`: downloaded audio files.
- `data/state.json`: dedupe state.
- `data/records.jsonl`: metadata records.
- `logs/`: daily downloader logs and RSSHub logs.

## Verify

```powershell
npm test
npm run acceptance
npm run download:dry-run
Get-ScheduledTask -TaskName "RSSHub Xiaoyuzhou AI Podcast Download"
```
