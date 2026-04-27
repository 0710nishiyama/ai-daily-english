import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

describe('Project setup verification', () => {
  it('should run a basic vitest test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should run a basic fast-check property test', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a)
      }),
      { numRuns: 100 }
    )
  })
})
