# Conventions

## Directory Structure

- `src/`: Node.js source modules.
- `scripts/`: PowerShell operational scripts for install, one-shot runs, RSSHub startup, and Windows scheduled task registration.
- `config/`: checked-in configuration templates and local setup notes. Real token files stay ignored.
- `test/`: Node test runner suites.
- `docs/superpowers/`: design and implementation planning notes created during AI-assisted development.
- `downloads/`: downloaded audio files, ignored by git.
- `data/`: runtime state and JSONL records, ignored by git.
- `logs/`: daily downloader and RSSHub logs, ignored by git.
- `tools/`: local RSSHub-Radar artifacts, ignored where they are generated or extracted.

## Runtime Files

- `config/settings.json` is the checked-in default configuration.
- `config/xiaoyuzhou-token.json` is local-only and ignored by git.
- `data/state.json` is local-only dedupe state.
- `data/records.jsonl` is local-only download metadata.
- `logs/YYYY-MM-DD.log` is the main per-run trace log.

## Script Conventions

- Use PowerShell scripts for Windows operations.
- `scripts/run-once.ps1` is the scheduled-task entrypoint and should remain safe for both manual and scheduled execution.
- `scripts/run-once.ps1` auto-detects a local proxy at `127.0.0.1:7890`; set `RSSHUB_DOWNLOADER_PROXY` to override it.
- Keep `127.0.0.1` and `localhost` in `NO_PROXY` so local RSSHub traffic stays direct.

## Source Module Responsibilities

- `src/downloader.js`: main CLI, config loading, RSSHub startup, feed fetching, keyword matching, download planning, file download, records, state, and logs.
- `src/rsshub-server.js`: local RSSHub wrapper service and RSSHub-Radar route data helpers.
- `src/xiaoyuzhou-search.js`: Xiaoyuzhou headers, credentials, SMS-auth support functions, token refresh, global search, and search result normalization.
- `src/xiaoyuzhou-auth.js`: CLI wrapper for sending SMS codes and logging in with SMS.

## Testing Conventions

- Use Node's built-in test runner through `npm test`.
- Keep tests focused on behavior that protects local automation: config parsing, keyword matching, RSS output, Xiaoyuzhou API normalization, token refresh, and scheduled script proxy support.
- Acceptance-style checks live in `test/acceptance-flow.test.js` and `test/global-search-flow.test.js`.

## Git Hygiene

- Do not commit runtime secrets, downloaded audio, logs, dedupe state, `node_modules`, or extracted RSSHub-Radar extension builds.
- Commit code, docs, configuration examples, and tests.
- Use small additive documentation updates instead of replacing existing project docs wholesale.
