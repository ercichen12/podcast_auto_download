# RSSHub-Radar Local Configuration

RSSHub-Radar is a browser extension. It discovers RSS and RSSHub routes on pages you visit; it does not run daily downloads by itself.

After loading the extension from `tools/rsshub-radar/chrome-mv3-prod`, open the extension options and set the RSSHub instance to:

```text
http://127.0.0.1:1200
```

When visiting a Xiaoyuzhou podcast page, use RSSHub-Radar to find the RSSHub route, then copy the Xiaoyuzhou podcast id or generated route into `config/settings.json` under `feeds`.

Example:

```json
{
  "name": "Example Xiaoyuzhou Podcast",
  "id": "6021f949a789fca4eff4492c"
}
```

or:

```json
{
  "name": "Example Xiaoyuzhou Podcast",
  "rsshubPath": "/xiaoyuzhou/podcast/6021f949a789fca4eff4492c"
}
```
