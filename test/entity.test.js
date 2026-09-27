/**
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * @file Test entity.js
 */

import { describe, expect, it } from 'vitest'
const {
  previousKey, isValidKey, newEntityId, newDeletableEntityId
} = require('../src/lib/entity')

describe('previousKey', () => {
  it('should prefix "previous:"', () => {
    expect(previousKey('jvn')).toBe('previous:jvn')
  })
})

describe('isValidKey', () => {
  it('should accept the fixed keys', () => {
    for (const key of ['urls', 'schedule', 'lastRateError']) {
      expect(isValidKey(key)).toBe(true)
    }
  })

  it('should accept per-feed keys up to 84 characters', () => {
    expect(isValidKey('previous:jvn')).toBe(true)
    expect(isValidKey(`previous:${'a'.repeat(84)}`)).toBe(true)
    expect(isValidKey(`previous:${'a'.repeat(85)}`)).toBe(false)
  })

  it('should reject other keys', () => {
    for (const key of [
      'previous', 'previous:', 'previous:a/b', 'toString', '', null, undefined
    ]) {
      expect(isValidKey(key)).toBe(false)
    }
  })
})

describe('newEntityId', () => {
  it('should create an ID of the "saver" entity', () => {
    const id = newEntityId('previous:jvn')
    expect(id.name).toBe('saver')
    expect(id.key).toBe('previous:jvn')
  })

  it('should throw for the legacy key', () => {
    expect(() => newEntityId('previous')).toThrow(ReferenceError)
  })
})

describe('newDeletableEntityId', () => {
  it('should accept the legacy key', () => {
    expect(newDeletableEntityId('previous').key).toBe('previous')
  })

  it('should accept valid keys', () => {
    expect(newDeletableEntityId('previous:jvn').key).toBe('previous:jvn')
  })

  it('should throw for invalid keys', () => {
    expect(() => newDeletableEntityId('previous:a/b')).toThrow(ReferenceError)
  })
})
