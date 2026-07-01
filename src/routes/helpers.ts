// Copy only whitelisted keys that are present in the request body.
export function pick<T>(body: Record<string, unknown>, keys: readonly string[]): T {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in body) out[key] = body[key]
  }
  return out as T
}

// Prisma throws P2025 when an update/delete targets a row that doesn't exist.
export function isNotFound(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: unknown }).code === 'P2025'
  )
}
