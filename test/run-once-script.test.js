import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('run-once script enables Node environment proxy for local mihomo', async () => {
  const script = await fs.readFile(path.join(projectRoot, 'scripts', 'run-once.ps1'), 'utf8');

  assert.match(script, /RSSHUB_DOWNLOADER_PROXY/);
  assert.match(script, /127\.0\.0\.1/);
  assert.match(script, /7890/);
  assert.match(script, /HTTP_PROXY/);
  assert.match(script, /HTTPS_PROXY/);
  assert.match(script, /NO_PROXY/);
  assert.match(script, /--use-env-proxy/);
});
