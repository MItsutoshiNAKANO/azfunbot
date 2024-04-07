import { describe, expect, it } from 'vitest'
const pickSchedules = require('../src/lib/pick-schedules')

describe('pickSchedules', () => {
  const now = new Date('2022-02-15 09:01')
  const locale = 'ja-JP'

  it('should return today', () => {
    const result = pickSchedules([{
      times: ['2022-02-15'], text: '#{today}'
    }], now, locale)
    expect(result).toStrictEqual({
      text: ['2022/2/15'], newSchedule: [{ times: [], text: '#{today}' }]
    })
  })

  it('should return tomorrow', () => {
    const result = pickSchedules([{
      times: ['2022-02-15'], text: '#{tomorrow}'
    }], now, locale)
    expect(result).toStrictEqual({
      text: ['2022/2/16'], newSchedule: [{ times: [], text: '#{tomorrow}' }]
    })
  })
})
