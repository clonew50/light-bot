/**
 * tests/scan-exclusions.mjs — todo 43: shared source-scan exclusion list
 * =====================================================================
 * Lane scanners (e.g. the dead-provider scan in unit.task-23 and the
 * worktree-clean check in unit.task-40) used to walk EVERYTHING under the
 * repo root — including gitignored runtime data (sub/ LevelDB shards,
 *.log / *.ldb) and the untracked orchestration tree (.omo/). Those paths
 * legitimately still hold old strings, so the scanners failed on data that
 * can never ship. This helper is the single asserted exclusion list.
 *
 * Rule: a shipped SOURCE path is scanned; runtime state and tooling output
 * is never. The underlying assertions are NOT weakened — a real source file
 * referencing the dead provider still fails.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';

/** Directory names that never contain source. */
export const EXCLUDED_DIRS = ['node_modules', 'sub', 'session', '.git', '.omo', 'tmp'];

/** Directory name patterns for backup folders (`*.bak-*`). */
export const EXCLUDED_DIR_PATTERNS = [/\.bak-/];

/** File names / suffixes that never contain source. */
export const EXCLUDED_FILES = [/\.log$/, /\.ldb$/, /(^|\/)panel-config\.json$/, /(^|\/)database\.json$/, /\.bak-/];

/**
 * هل المسار مستثني من فحص المصدر؟ (يقبل مسار نسبي أو مطلق)
 * @param {string} p
 * @returns {boolean}
 */
export function isExcludedPath(p) {
  const rel = path.normalize(p).split(path.sep);
  const name = rel[rel.length - 1];
  if (EXCLUDED_DIRS.includes(name)) return true;
  for (const part of rel) {
    if (EXCLUDED_DIRS.includes(part)) return true;
    if (EXCLUDED_DIR_PATTERNS.some((re) => re.test(part))) return true;
  }
  if (EXCLUDED_FILES.some((re) => re.test(p))) return true;
  return false;
}

/**
 * walk only the source paths under `dir` (exclusions applied).
 * @param {string} dir
 * @param {string[]} [out]
 * @returns {string[]}
 */
export function walkSourceTree(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (isExcludedPath(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isExcludedPath(full)) continue;
      walkSourceTree(full, out);
    } else if (entry.isFile()) {
      if (isExcludedPath(full)) continue;
      out.push(full);
    }
  }
  return out;
}

/** هل سطر git status ده مستثني (مسارات غير المصدر)؟ */
export function isExcludedStatusLine(line) {
  // "?? .omo/" | "M plugins/foo.js" | "A tests/x.mjs" | "R  old -> new"
  const rest = line.replace(/^(.{2})\s+/, '');
  const target = rest.split(' -> ').pop() || '';
  return isExcludedPath(target) || isExcludedPath(target.replace(/\/$/, ''));
}