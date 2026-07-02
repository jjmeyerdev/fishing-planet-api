import { describe, it, expect } from 'vitest'
import { pick, isNotFound } from '../src/routes/helpers.js'

describe('pick', () => {
  it('keeps only whitelisted keys that are present', () => {
    const out = pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])
    expect(out).toEqual({ a: 1, c: 3 })
  })

  it('ignores whitelisted keys absent from the body', () => {
    const out = pick({ a: 1 }, ['a', 'b'])
    expect(out).toEqual({ a: 1 })
    expect('b' in (out as object)).toBe(false)
  })

  it('drops every non-whitelisted key', () => {
    const out = pick({ id: 999, role: 'admin', name: 'ok' }, ['name'])
    expect(out).toEqual({ name: 'ok' })
  })
})

describe('isNotFound', () => {
  it('is true for Prisma P2025', () => {
    expect(isNotFound({ code: 'P2025' })).toBe(true)
  })

  it('is false for other Prisma error codes', () => {
    expect(isNotFound({ code: 'P2002' })).toBe(false)
  })

  it('is false for non-error values', () => {
    expect(isNotFound(null)).toBe(false)
    expect(isNotFound(new Error('boom'))).toBe(false)
    expect(isNotFound('P2025')).toBe(false)
  })
})
