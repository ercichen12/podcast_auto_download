# RSSHub-Radar Xiaoyuzhou AI Downloader Design

## Goal

Install and configure a local RSSHub-Radar + RSSHub workflow that discovers Xiaoyuzhou RSSHub sources, checks them daily for AI-related keywords, downloads matching podcast audio, and records state.

## Components

- RSSHub-Radar: browser extension used manually on Xiaoyuzhou pages to discover RSSHub routes. It is prepared from the official release zip and loaded unpacked in Chrome or Edge.
- RSSHub: local wrapper service running on `http://127.0.0.1:1200`, backed by the official `rsshub` npm package library API.
- Downloader: Node.js CLI that fetches RSS, filters items by keyword, downloads audio, writes records, and keeps dedupe state.
- Scheduler: Windows Task Scheduler entry that runs the downloader daily.

## Data Flow

1. User visits a Xiaoyuzhou podcast page.
2. RSSHub-Radar discovers/copies the RSSHub route for the page.
3. The route or podcast id is added to `config/settings.json`.
4. Windows Task Scheduler runs `scripts/run-once.ps1` daily.
5. The downloader starts RSSHub if it is not already running.
6. The downloader fetches configured RSSHub feeds. The default feeds are three Xiaoyuzhou AI-related podcasts; users can add or replace feeds discovered with RSSHub-Radar.
7. Matching items are downloaded and recorded.

## Testing

- Unit tests cover id parsing, URL construction, keyword matching, dedupe, safe filenames, and CLI args.
- Acceptance flow starts a local fixture RSS/audio server and verifies download and dedupe end to end.
- Live dry-run verifies local RSSHub startup and RSSHub feed parsing without downloading audio.
