# Xiaoyuzhou Global Search

Global search is an additional downloader source. It does not replace the configured RSSHub podcast feeds.

## Search Logic

For each keyword in `config/settings.json` at `globalSearch.keywords`:

1. Call Xiaoyuzhou's app-compatible episode search endpoint.
2. Request at most `globalSearch.limitPerKeyword` results.
3. Drop results older than `globalSearch.lookbackDays`.
4. Normalize each result into the downloader's RSS-like item format.
5. Reuse the existing keyword matcher over title, shownotes, podcast name, author, link, guid, and categories.
6. Download matching audio only if `data/state.json` has not processed the episode key before.

The episode key is `xiaoyuzhou:episode:<eid>` when Xiaoyuzhou returns an episode id.

## Auth File

The API requires local Xiaoyuzhou auth. The easiest path is SMS login:

```powershell
npm run xiaoyuzhou:send-code -- --phone 13800138000
npm run xiaoyuzhou:login -- --phone 13800138000 --code 123456
```

For non-mainland phone numbers, add `--area-code`:

```powershell
npm run xiaoyuzhou:send-code -- --area-code +1 --phone 5551234567
npm run xiaoyuzhou:login -- --area-code +1 --phone 5551234567 --code 123456
```

Login writes tokens to:

```text
config/xiaoyuzhou-token.json
```

Use this shape:

```json
{
  "accessToken": "x-jike-access-token",
  "refreshToken": "x-jike-refresh-token",
  "deviceId": "x-jike-device-id"
}
```

The real token file is ignored by git. `config/xiaoyuzhou-token.example.json` is only a template.

If `accessToken` is missing, the downloader logs a skip message for global search and still runs the fixed RSS feeds.

If a search request gets 401 and `refreshToken` exists, the downloader refreshes once through `/app_auth_tokens.refresh`, saves the new tokens back to the same file, and retries the search.

## What the user needs to do

1. Provide the phone number used by the Xiaoyuzhou account, or run the `send-code` command locally.
2. Read the SMS verification code from the phone.
3. Run the `login` command with that code within the SMS validity window.
4. Run `npm run download:dry-run` and check that the log says `Fetched ... global Xiaoyuzhou search item(s)` instead of `missing accessToken`.

## Log Map

The downloader log now follows the same flow every run:

1. `Global search auth state` tells you whether the token file exists and which pieces are present.
2. `Global search keyword start` marks the beginning of a search for one keyword.
3. `[xiaoyuzhou-search] search start` shows the exact keyword, limit, lookback window, and API base.
4. `[xiaoyuzhou-search] search response` shows received, processed, kept, and skipped-old counts.
5. `Global search keyword plan result` shows how many items survived keyword matching and dedupe checks.
6. `Downloading global search result` and `Download finished` bracket the actual file transfer.
7. `Record appended` and `State written` show persistence completion.
