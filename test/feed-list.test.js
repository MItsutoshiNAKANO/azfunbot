/**
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * @file Test feed-list.js
 */

import { describe, expect, it } from 'vitest'
const {
  validateFeedList, findDuplicateUrls, describeSkipped
} = require('../src/lib/feed-list')

describe('validateFeedList', () => {
  it('should accept valid entries with their positions', () => {
    const result = validateFeedList([
      { key: 'jvn', url: 'https://jvn.jp/rss/jvn.rdf' },
      { key: 'zd_net-1', url: 'http://feeds.japan.zdnet.com/rss/zdnet/all.rdf' }
    ])
    expect(result).toStrictEqual({
      feeds: [
        { key: 'jvn', url: 'https://jvn.jp/rss/jvn.rdf', position: 1 },
        {
          key: 'zd_net-1',
          url: 'http://feeds.japan.zdnet.com/rss/zdnet/all.rdf',
          position: 2
        }
      ],
      skipped: []
    })
  })

  it('should accept a key of 84 characters and reject 85', () => {
    const url = 'https://example.com/feed'
    const result = validateFeedList([
      { key: 'a'.repeat(84), url }, { key: 'b'.repeat(85), url }
    ])
    expect(result.feeds.map((feed) => feed.position)).toStrictEqual([1])
    expect(result.skipped).toStrictEqual([{
      position: 2,
      reason: `key "${'b'.repeat(85)}" must match ^[A-Za-z0-9_-]{1,84}$`
    }])
  })

  it('should report each violation with the specified wording', () => {
    const url = 'https://example.com/feed'
    const result = validateFeedList([
      'https://jvn.jp/rss/jvn.rdf',
      { url },
      { key: 'a/b', url },
      { key: 'ok' },
      { key: 'rel', url: 'foo' },
      { key: 'ftp', url: 'ftp://example.com/feed' },
      { key: 'ok', url },
      { key: 'ok', url }
    ])
    expect(result.feeds).toStrictEqual([{ key: 'ok', url, position: 7 }])
    expect(result.skipped).toStrictEqual([
      { position: 1, reason: 'entry is not an object' },
      { position: 2, reason: 'key is missing or not a string' },
      { position: 3, reason: 'key "a/b" must match ^[A-Za-z0-9_-]{1,84}$' },
      { position: 4, reason: 'url is missing or not a string' },
      { position: 5, reason: 'url "foo" is not an absolute URL' },
      { position: 6, reason: 'url "ftp://example.com/feed" must use http or https' },
      { position: 8, reason: 'key "ok" is duplicated' }
    ])
  })

  it('should reject a value that is not an array', () => {
    expect(validateFeedList({ key: 'jvn' })).toStrictEqual({
      feeds: [], skipped: [{ position: null, reason: '"urls" is not an array' }]
    })
  })
})

describe('findDuplicateUrls', () => {
  it('should list URLs registered under more than one key', () => {
    const url = 'https://example.com/feed'
    expect(findDuplicateUrls([
      { key: 'a', url, position: 1 },
      { key: 'b', url: 'https://example.org/feed', position: 2 },
      { key: 'c', url, position: 3 }
    ])).toStrictEqual([{ url, keys: ['a', 'c'] }])
  })
})

describe('describeSkipped', () => {
  it('should prefix the position', () => {
    expect(describeSkipped({ position: 4, reason: 'entry is not an object' }))
      .toBe('#4 entry is not an object')
  })

  it('should omit a missing position', () => {
    expect(describeSkipped({ position: null, reason: '"urls" is not an array' }))
      .toBe('"urls" is not an array')
  })
})
