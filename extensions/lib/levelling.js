const BASE_XP = 100

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeLevel(level) {
  return Math.max(0, Math.floor(toFiniteNumber(level, 0)))
}

function normalizeMultiplier(multiplier) {
  const value = toFiniteNumber(multiplier, 1)
  return value > 0 ? value : 1
}

/**
 * Return the XP boundaries for a level.
 *
 * `min` is the XP already required to reach the current level, `max` is the
 * first XP value that allows the next level, and `xp` is the width of the
 * current level range.
 */
export function xpRange(level, multiplier = 1) {
  const currentLevel = normalizeLevel(level)
  const scale = normalizeMultiplier(multiplier)
  const min = BASE_XP * currentLevel * currentLevel
  const max = BASE_XP * (currentLevel + 1) * (currentLevel + 1) * scale

  return {
    min,
    xp: Math.max(0, max - min),
    max,
  }
}

/** Whether the supplied XP is enough to advance from `level`. */
export function canLevelUp(level, exp, multiplier = 1) {
  const currentExp = toFiniteNumber(exp, 0)
  return currentExp >= xpRange(level, multiplier).max
}

export default { canLevelUp, xpRange }
