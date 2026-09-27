/**
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * @file Test rss-watcher.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, fakeContext } from './fakes'
const {
  DEFAULT_FETCH_TIMEOUT_MILLI_SEC, fetchTimeout, createParser,
  describeFetchError, toItems, planFeed, buildAdminReport, watch
} = require('../src/lib/rss-watcher')

const jvnUrl = 'https://jvn.jp/rss/jvn.rdf'
const gihyoUrl = 'https://gihyo.jp/feed/atom'
const urls = [
  { key: 'jvn', url: jvnUrl },
  { key: 'gihyo', url: gihyoUrl }
]

/**
 * Create a parser that answers from a table.
 * @param {Object<string, (Array<{link: string, title: string}>|Error)>}
 *   responses Items or an error by URL.
 * @returns {{parseURL: Function}} The parser.
 */
function fakeParser (responses) {
  return {
    parseURL: vi.fn(async (url) => {
      const response = responses[url]
      if (response instanceof Error) { throw response }
      return { items: response }
    })
  }
}

/**
 * Create a feed item.
 * @param {string} link Link of the item.
 * @returns {{link: string, title: string}} The item.
 */
function item (link) { return { link, title: `Title of ${link}` } }

describe('fetchTimeout', () => {
  it('should default to 30000 ms', () => {
    expect(fetchTimeout({})).toBe(30000)
    expect(fetchTimeout({ DIFFRSS_FETCH_TIMEOUT_MILLI_SEC: 'abc' }))
      .toBe(DEFAULT_FETCH_TIMEOUT_MILLI_SEC)
  })

  it('should read DIFFRSS_FETCH_TIMEOUT_MILLI_SEC', () => {
    expect(fetchTimeout({ DIFFRSS_FETCH_TIMEOUT_MILLI_SEC: '5000' })).toBe(5000)
  })

  it('should be passed to rss-parser', () => {
    expect(createParser(fetchTimeout({})).options.timeout).toBe(30000)
  })
})

describe('describeFetchError', () => {
  it('should describe an HTTP error', () => {
    expect(describeFetchError(new Error('Status code 503'), 30000))
      .toBe('HTTP 503')
  })

  it('should describe a timeout', () => {
    expect(describeFetchError(new Error('Request timed out after 30000ms'), 30000))
      .toBe('timed out after 30000 ms')
  })

  it('should describe a network error by its message', () => {
    const error = Object.assign(new Error('getaddrinfo ENOTFOUND x'), {
      code: 'ENOTFOUND'
    })
    expect(describeFetchError(error, 30000)).toBe('getaddrinfo ENOTFOUND x')
  })

  it('should describe other errors as parse errors', () => {
    expect(describeFetchError(new Error('Feed not recognized as RSS 1 or 2.'), 30000))
      .toBe('parse error: Feed not recognized as RSS 1 or 2.')
  })
})

describe('toItems', () => {
  it('should drop items without a link and duplicated links', () => {
    expect(toItems({
      items: [item('a'), { title: 'no link' }, item('a'), item('b')]
    })).toStrictEqual([item('a'), item('b')])
  })

  it('should accept a feed without items', () => {
    expect(toItems({})).toStrictEqual([])
  })
})

describe('planFeed', () => {
  const feed = { key: 'jvn', url: jvnUrl, position: 1 }

  it('should save without notifying on the first fetch', () => {
    expect(planFeed(feed, [item('a')], undefined)).toStrictEqual({
      newItems: [],
      value: { url: jvnUrl, links: ['a'] },
      firstTime: true,
      invalidState: false,
      urlChanged: false
    })
  })

  it('should treat a malformed state as the first fetch', () => {
    const plan = planFeed(feed, [item('a')], ['a'])
    expect(plan.firstTime).toBe(true)
    expect(plan.invalidState).toBe(true)
    expect(plan.newItems).toStrictEqual([])
  })

  it('should notify new items and save the current links', () => {
    const plan = planFeed(feed, [item('a'), item('b')], {
      url: jvnUrl, links: ['a']
    })
    expect(plan.newItems).toStrictEqual([item('b')])
    expect(plan.value).toStrictEqual({ url: jvnUrl, links: ['a', 'b'] })
  })

  it('should save when an item disappeared', () => {
    const plan = planFeed(feed, [item('b')], { url: jvnUrl, links: ['a', 'b'] })
    expect(plan.newItems).toStrictEqual([])
    expect(plan.value).toStrictEqual({ url: jvnUrl, links: ['b'] })
  })

  it('should not save when nothing changed', () => {
    const plan = planFeed(feed, [item('b'), item('a')], {
      url: jvnUrl, links: ['a', 'b']
    })
    expect(plan.newItems).toStrictEqual([])
    expect(plan.value).toBe(null)
  })

  it('should use the saved links even if the url changed', () => {
    const plan = planFeed(feed, [item('a')], {
      url: 'https://old.example.com/feed', links: ['a']
    })
    expect(plan.newItems).toStrictEqual([])
    expect(plan.urlChanged).toBe(true)
    expect(plan.previousUrl).toBe('https://old.example.com/feed')
    expect(plan.value).toStrictEqual({ url: jvnUrl, links: ['a'] })
  })
})

describe('buildAdminReport', () => {
  it('should list failures and skipped entries', () => {
    expect(buildAdminReport({
      failures: [
        { feed: { key: 'jvn', url: jvnUrl }, reason: 'HTTP 503' },
        {
          feed: { key: 'gihyo', url: gihyoUrl },
          reason: 'timed out after 30000 ms'
        }
      ],
      skipped: [{
        position: 4, reason: 'key "a/b" must match ^[A-Za-z0-9_-]{1,84}$'
      }]
    })).toStrictEqual([
      '[AzFunBot] diffRss: 2 failed, 1 skipped',
      'Failed: jvn https://jvn.jp/rss/jvn.rdf HTTP 503',
      'Failed: gihyo https://gihyo.jp/feed/atom timed out after 30000 ms',
      'Skipped: #4 key "a/b" must match ^[A-Za-z0-9_-]{1,84}$'
    ])
  })

  it('should report that no feed is valid', () => {
    expect(buildAdminReport({
      failures: [],
      skipped: [{ position: 1, reason: 'entry is not an object' }],
      noValidFeeds: true
    })).toStrictEqual([
      '[AzFunBot] diffRss: no valid feeds in "urls"',
      'Skipped: #1 entry is not an object'
    ])
  })
})

describe('watch', () => {
  const env = { LINE_ADMIN_ID: 'admin' }
  let context
  let send

  beforeEach(() => {
    context = fakeContext()
    send = vi.fn(async () => {})
  })

  it('should notify new items when every feed succeeds', async () => {
    const client = fakeClient({
      'previous:jvn': { url: jvnUrl, links: ['j1'] },
      'previous:gihyo': { url: gihyoUrl, links: ['g1'] }
    })
    const parser = fakeParser({
      [jvnUrl]: [item('j1'), item('j2')], [gihyoUrl]: [item('g1')]
    })
    await watch(urls, context, { client, parser, send, env })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(['j2 Title of j2'], context)
    expect(client.signals).toStrictEqual([{
      key: 'previous:jvn', op: 'post', value: { url: jvnUrl, links: ['j1', 'j2'] }
    }])
  })

  it('should keep going when some feeds fail', async () => {
    const client = fakeClient({
      'previous:jvn': { url: jvnUrl, links: ['j1'] },
      'previous:gihyo': { url: gihyoUrl, links: ['g1'] }
    })
    const parser = fakeParser({
      [jvnUrl]: [item('j1'), item('j2')],
      [gihyoUrl]: new Error('Status code 503')
    })
    await watch(urls, context, { client, parser, send, env })
    expect(send).toHaveBeenNthCalledWith(1, ['j2 Title of j2'], context)
    expect(send).toHaveBeenNthCalledWith(2, [
      '[AzFunBot] diffRss: 1 failed, 0 skipped',
      'Failed: gihyo https://gihyo.jp/feed/atom HTTP 503'
    ], context, 'admin')
    expect(client.reads).toStrictEqual(['previous:jvn'])
    expect(client.signals.map((signal) => signal.key))
      .toStrictEqual(['previous:jvn'])
    expect(context.warn).toHaveBeenCalledWith(
      'Failed to fetch gihyo https://gihyo.jp/feed/atom: HTTP 503'
    )
  })

  it('should notify only real new items after a feed recovers', async () => {
    const client = fakeClient({
      'previous:jvn': { url: jvnUrl, links: ['j1'] },
      'previous:gihyo': { url: gihyoUrl, links: ['g1', 'g2'] }
    })
    const parser = fakeParser({
      [jvnUrl]: [item('j1')], [gihyoUrl]: [item('g1'), item('g2'), item('g3')]
    })
    await watch(urls, context, { client, parser, send, env })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(['g3 Title of g3'], context)
  })

  it('should notify the admin and throw when every feed fails', async () => {
    const client = fakeClient()
    const parser = fakeParser({
      [jvnUrl]: new Error('Status code 500'),
      [gihyoUrl]: new Error('Request timed out after 30000ms')
    })
    await expect(watch(urls, context, { client, parser, send, env }))
      .rejects.toThrow('All feeds failed to fetch')
    expect(client.signals).toStrictEqual([])
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith([
      '[AzFunBot] diffRss: 2 failed, 0 skipped',
      'Failed: jvn https://jvn.jp/rss/jvn.rdf HTTP 500',
      'Failed: gihyo https://gihyo.jp/feed/atom timed out after 30000 ms'
    ], context, 'admin')
  })

  it('should notify the admin without fetching when no feed is valid', async () => {
    const client = fakeClient()
    const parser = fakeParser({})
    await watch([jvnUrl], context, { client, parser, send, env })
    expect(parser.parseURL).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith([
      '[AzFunBot] diffRss: no valid feeds in "urls"',
      'Skipped: #1 entry is not an object'
    ], context, 'admin')
    expect(context.error).toHaveBeenCalledWith('No valid feeds in "urls"')
  })

  it('should report skipped entries while watching valid ones', async () => {
    const client = fakeClient({ 'previous:jvn': { url: jvnUrl, links: ['j1'] } })
    const parser = fakeParser({ [jvnUrl]: [item('j1')] })
    await watch([urls[0], { key: 'a/b', url: gihyoUrl }], context, {
      client, parser, send, env
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith([
      '[AzFunBot] diffRss: 0 failed, 1 skipped',
      'Skipped: #2 key "a/b" must match ^[A-Za-z0-9_-]{1,84}$'
    ], context, 'admin')
    expect(context.warn).toHaveBeenCalledWith(
      'Skipped urls entry #2: key "a/b" must match ^[A-Za-z0-9_-]{1,84}$'
    )
  })

  it('should save the first fetch without notifying', async () => {
    const client = fakeClient()
    const parser = fakeParser({ [jvnUrl]: [item('j1')], [gihyoUrl]: [item('g1')] })
    await watch(urls, context, { client, parser, send, env })
    expect(send).not.toHaveBeenCalled()
    expect(client.store.get('previous:jvn')).toStrictEqual({
      url: jvnUrl, links: ['j1']
    })
    expect(client.store.get('previous:gihyo')).toStrictEqual({
      url: gihyoUrl, links: ['g1']
    })
    expect(context.log).toHaveBeenCalledWith(
      'First fetch for jvn; saved 1 links without notifying'
    )
  })

  it('should save the new url when the url changed', async () => {
    const oldUrl = 'https://old.example.com/feed'
    const client = fakeClient({ 'previous:jvn': { url: oldUrl, links: ['j1'] } })
    const parser = fakeParser({ [jvnUrl]: [item('j1')] })
    await watch([urls[0]], context, { client, parser, send, env })
    expect(send).not.toHaveBeenCalled()
    expect(client.store.get('previous:jvn')).toStrictEqual({
      url: jvnUrl, links: ['j1']
    })
    expect(context.log).toHaveBeenCalledWith(
      `Feed url for jvn changed from ${oldUrl} to ${jvnUrl}`
    )
  })

  it('should not notify the admin when LINE_ADMIN_ID is not set', async () => {
    const client = fakeClient()
    const parser = fakeParser({
      [jvnUrl]: [item('j1')], [gihyoUrl]: new Error('Status code 404')
    })
    await watch(urls, context, { client, parser, send, env: {} })
    expect(send).not.toHaveBeenCalled()
    expect(context.log).toHaveBeenCalledWith(
      'LINE_ADMIN_ID is not set; skipped admin notification'
    )
  })

  it('should finish normally when notifying the admin fails', async () => {
    const client = fakeClient({ 'previous:jvn': { url: jvnUrl, links: [] } })
    const parser = fakeParser({
      [jvnUrl]: [item('j1')], [gihyoUrl]: new Error('Status code 404')
    })
    send.mockImplementation(async (lines, _context, to) => {
      if (to === 'admin') { throw new Error('quota exceeded') }
    })
    await watch(urls, context, { client, parser, send, env })
    expect(send).toHaveBeenCalledTimes(2)
    expect(context.error).toHaveBeenCalledWith(
      'Failed to notify admin: quota exceeded'
    )
  })

  it('should still notify the admin when the main notification fails', async () => {
    const client = fakeClient({ 'previous:jvn': { url: jvnUrl, links: [] } })
    const parser = fakeParser({
      [jvnUrl]: [item('j1')], [gihyoUrl]: new Error('Status code 404')
    })
    send.mockImplementation(async (lines, _context, to) => {
      if (to === undefined) { throw new Error('LINE is down') }
    })
    await expect(watch(urls, context, { client, parser, send, env }))
      .rejects.toThrow('LINE is down')
    expect(send).toHaveBeenLastCalledWith(expect.any(Array), context, 'admin')
  })

  it('should log a summary', async () => {
    const client = fakeClient({ 'previous:jvn': { url: jvnUrl, links: ['j1'] } })
    const parser = fakeParser({
      [jvnUrl]: [item('j1'), item('j2')], [gihyoUrl]: [item('g1')]
    })
    await watch(urls, context, { client, parser, send, env })
    expect(context.log).toHaveBeenCalledWith('diffRss summary: 2 succeeded, ' +
      '0 failed, 0 skipped, 1 first-time, 1 new items, 2 writes')
  })
})
