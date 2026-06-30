# RSSHub-Radar Xiaoyuzhou AI Downloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local RSSHub-Radar + RSSHub + downloader setup that discovers Xiaoyuzhou RSSHub sources and downloads AI keyword podcast episodes daily.

**Architecture:** RSSHub-Radar is prepared as an unpacked browser extension; RSSHub is installed as a local npm dependency and started on localhost; the downloader is a Node CLI run by Windows Task Scheduler. The downloader fetches configured feeds, filters by keyword, downloads audio, and writes state/log records.

**Tech Stack:** Node.js 24, npm, RSSHub, RSSHub-Radar release zip, RSS Parser, PowerShell, Windows Task Scheduler.

---

### Task 1: Local Project Files

- [x] Create `package.json`, `.gitignore`, and `config/settings.json`.
- [x] Create RSSHub-Radar local configuration notes.
- [x] Create downloader tests and implementation.
- [x] Create PowerShell scripts for RSSHub-Radar install, RSSHub start, one-shot run, and scheduled task registration.
- [x] Create README and design/plan docs.

### Task 2: Test-Driven Downloader

- [ ] Run tests before implementation and verify failure where applicable.
- [ ] Run unit tests after implementation.
- [ ] Run acceptance flow to verify RSS parse, keyword match, download, metadata, state, and dedupe.

### Task 3: RSSHub-Radar

- [ ] Download `chrome-mv3-prod.zip` from RSSHub-Radar release `v2.2.0`.
- [ ] Extract to `tools/rsshub-radar/chrome-mv3-prod`.
- [ ] Verify `manifest.json` exists.

### Task 4: RSSHub

- [ ] Install npm dependencies.
- [ ] Start local RSSHub on `http://127.0.0.1:1200`.
- [ ] Verify local RSSHub responds.
- [ ] Run downloader dry-run against configured Xiaoyuzhou feed.

### Task 5: Scheduler

- [ ] Register Windows scheduled task named `RSSHub Xiaoyuzhou AI Podcast Download`.
- [ ] Verify task exists.
- [ ] Trigger task once or run the same command manually.

### Task 6: Delivery

- [ ] Confirm files exist.
- [ ] Confirm tests and acceptance checks pass.
- [ ] Confirm known limits: RSSHub-Radar is manually loaded in browser; Xiaoyuzhou podcast-specific feeds need ids/routes discovered by Radar.
