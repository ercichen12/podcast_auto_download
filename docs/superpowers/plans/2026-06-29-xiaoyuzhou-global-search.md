# Xiaoyuzhou Global Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Xiaoyuzhou global keyword search as an additional source for the existing daily AI podcast downloader.

**Architecture:** Keep RSSHub/RSSHub-Radar and fixed podcast RSS feeds unchanged. Add a focused search module that calls Xiaoyuzhou's API-compatible search flow, normalizes search results into downloader items, and reuses the existing keyword match, download, state, record, and scheduler paths.

**Tech Stack:** Node.js 24, node:test, rss-parser, local RSSHub wrapper, PowerShell scheduled task, Xiaoyuzhou API behavior referenced from open-source clients.

---

### Task 1: Research and Interface

- [ ] Inspect open-source Xiaoyuzhou API clients for global search endpoint, headers, pagination, and auth behavior.
- [ ] Define a local search module API that can be tested without network access.
- [ ] Keep auth secrets out of tracked config files.

### Task 2: Search Module with Tests

- [ ] Add failing tests for search config defaults, request construction, result normalization, date filtering, and dedupe keys.
- [ ] Implement only enough search module code to pass those tests.
- [ ] Keep the module independent from RSSHub so all external API assumptions are isolated.

### Task 3: Downloader Integration

- [ ] Add failing tests showing global search results flow through the existing download planner.
- [ ] Modify the downloader to run fixed RSS feeds first, then enabled global searches.
- [ ] Reuse existing keyword matching, audio download, `data/state.json`, and `data/records.jsonl`.

### Task 4: Config and Documentation

- [ ] Add `globalSearch` settings to `config/settings.json`.
- [ ] Document how to provide Xiaoyuzhou auth locally without committing tokens.
- [ ] Update README with the exact search logic and known limits.

### Task 5: Verification

- [ ] Run unit tests and acceptance tests.
- [ ] Run a dry-run against real Xiaoyuzhou search when auth is available.
- [ ] Run one real download path or a controlled fixture if the external API blocks audio access.
- [ ] Re-run to verify dedupe skips already processed search results.
