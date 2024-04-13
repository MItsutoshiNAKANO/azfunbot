import { describe, expect, it } from 'vitest'
const pickSchedules = require('../src/lib/pick-schedules')

describe('pickSchedules', () => {
  const now = new Date('2024-04-13 09:01')
  const locale = 'ja-JP'

  it('should return today', () => {
    const result = pickSchedules([{
      times: ['2024-04-13'], text: '#{today}'
    }], now, locale)
    expect(result).toStrictEqual({
      text: ['2024/4/13'], newSchedule: [{ times: [], text: '#{today}' }]
    })
  })

  it('should return tomorrow', () => {
    const result = pickSchedules([{
      times: ['2024-04-13'], text: '#{tomorrow}'
    }], now, locale)
    expect(result).toStrictEqual({
      text: ['2024/4/14'], newSchedule: [{ times: [], text: '#{tomorrow}' }]
    })
  })
})
