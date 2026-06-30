# Decisions

## 2026-06-29: Local RSSHub/RSSHub-Radar Setup

Use RSSHub-Radar as a manually loaded browser extension for discovering Xiaoyuzhou RSSHub routes, and run a local RSSHub service at `http://127.0.0.1:1200`.

Reasoning: RSSHub-Radar is useful for discovering routes while browsing, but scheduled downloading needs a stable local service and scriptable configuration. Keeping the browser extension and downloader separate avoids depending on Chrome state during daily automation.

## 2026-06-29: Downloader State and Records

Store dedupe state in `data/state.json`, append download metadata to `data/records.jsonl`, and write daily logs under `logs/`.

Reasoning: state prevents repeat downloads, JSONL records are easy to inspect and append, and daily logs make a single run traceable from search through download completion.

## 2026-06-29: Xiaoyuzhou Global Search as a Separate Source

Implement Xiaoyuzhou global search with Xiaoyuzhou-compatible API calls instead of routing it through RSSHub/RSSHub-Radar.

Reasoning: RSSHub/RSSHub-Radar works well for known podcast feeds, while global keyword search needs authenticated API calls and search result normalization. The downloader reuses the same keyword matching, download, record, and dedupe path after search results are normalized.

Tradeoff: this requires local Xiaoyuzhou tokens. Tokens stay in `config/xiaoyuzhou-token.json`, which is ignored by git.

## 2026-06-30: SMS Login and Token Refresh

Use SMS login to obtain Xiaoyuzhou tokens, store them locally, and refresh once automatically on 401.

Reasoning: this keeps token setup reproducible without copying secrets from browser developer tools. Refresh-on-401 reduces manual maintenance while still keeping credentials local.

## 2026-06-30: Proxy for Remote Audio Downloads

Use a local proxy when available at `127.0.0.1:7890`, and allow override through `RSSHUB_DOWNLOADER_PROXY`.

Reasoning: Xiaoyuzhou provides episode metadata, but the actual audio URL can point to the original hosting provider, such as `anchor.fm` or CloudFront. Some providers block or timeout on the direct network path. The local proxy allows those remote audio URLs to download while `NO_PROXY` keeps local RSSHub traffic direct.

Outcome: the previously failing B2B episode hosted through `anchor.fm` downloaded successfully when `HTTP_PROXY`, `HTTPS_PROXY`, and `NODE_OPTIONS=--use-env-proxy` were enabled.

## 2026-06-30: GitHub Repository

Initialize the local project as a Git repository and push it to `https://github.com/ercichen12/podcast_auto_download`.

Reasoning: the user created the GitHub repository for backup and ongoing iteration. Runtime data, downloads, logs, dependencies, and local tokens remain untracked through `.gitignore`.
