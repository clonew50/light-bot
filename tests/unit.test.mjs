// Aggregator for the unit suite: every lane keeps its cases in tests/unit.task-<N>.test.mjs.
// This file imports them all so `node --test tests/unit.test.mjs` runs the whole suite.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => /^unit\.task-\d+\.test\.mjs$/.test(f)).sort();
for (const f of files) await import(pathToFileURL(join(here, f)).href);
