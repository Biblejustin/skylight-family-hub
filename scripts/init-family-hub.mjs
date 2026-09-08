#!/usr/bin/env node
// New installations only. Never merge, replace or reset existing family data.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configPath = path.resolve('data/config.json');
const template = JSON.parse(await readFile(path.join(root, 'examples/config.json'), 'utf8'));
const timezone = process.env.TZ || template.settings.timezone;
// Validate before creating anything.
new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
template.settings.timezone = timezone;
await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
try {
  await writeFile(configPath, JSON.stringify(template, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Created empty Family Hub screens. Set a parent password before adding private feeds.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing configuration preserved.');
}
