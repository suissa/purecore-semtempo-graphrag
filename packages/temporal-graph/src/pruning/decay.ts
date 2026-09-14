export interface DecayOptions {
  halfLifeMs?: number
  lambda?: number
  accessWeight?: number
}

export interface AccessTracker {
  accessCount: number
  lastAccessedAt: number
}

export function calculateExponentialDecay(
  activatedAt: number,
  currentTime: number = Date.now(),
  options: DecayOptions = {}
): number {
  if (currentTime <= activatedAt) {
    return 1.0
  }

  const lambda =
    options.lambda ??
    Math.LN2 / (options.halfLifeMs ?? 86400000)

  const timeDelta = currentTime - activatedAt
  return Math.exp(-lambda * timeDelta)
}

export function calculateRelevanceScore(
  activatedAt: number,
  currentTime: number = Date.now(),
  tracker?: AccessTracker,
  options: DecayOptions = {}
): number {
  const timeDecay = calculateExponentialDecay(activatedAt, currentTime, options)
  
  if (!tracker || tracker.accessCount === 0) {
    return timeDecay
  }

  const accessWeight = options.accessWeight ?? 0.2
  const accessBoost = Math.log10(1 + tracker.accessCount) * accessWeight
  const recencyBoost = calculateExponentialDecay(tracker.lastAccessedAt, currentTime, options) * 0.1

  return Math.min(1.0, timeDecay + accessBoost + recencyBoost)
}
