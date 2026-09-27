/**
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * @file Test maintain-handler.js
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { fakeClient, fakeContext } from './fakes'
const handleMaintain = require('../src/lib/maintain-handler')

/**
 * Create an HTTP request.
 * @param {string} method HTTP method.
 * @param {string} key The "key" query parameter.
 * @param {*} [body] The JSON body.
 * @returns {{method: string, query: URLSearchParams, json: Function}}
 *   The request.
 */
function request (method, key, body) {
  return {
    method,
    query: new URLSearchParams({ key }),
    json: async () => body
  }
}

describe('handleMaintain', () => {
  let context

  beforeEach(() => { context = fakeContext() })

  it('should return the entity state on GET', async () => {
    const client = fakeClient({ 'previous:jvn': { url: 'u', links: [] } })
    const response = await handleMaintain(
      request('GET', 'previous:jvn'), context, client
    )
    expect(response).toStrictEqual({
      body: JSON.stringify({ url: 'u', links: [] })
    })
  })

  it('should save valid urls on POST', async () => {
    const client = fakeClient()
    const urls = [{ key: 'jvn', url: 'https://jvn.jp/rss/jvn.rdf' }]
    const response = await handleMaintain(
      request('POST', 'urls', urls), context, client
    )
    expect(response).toStrictEqual({ body: 'accept' })
    expect(client.store.get('urls')).toStrictEqual(urls)
  })

  it('should reject invalid urls on POST with 400', async () => {
    const client = fakeClient()
    const response = await handleMaintain(request('POST', 'urls', [
      { key: 'jvn', url: 'https://jvn.jp/rss/jvn.rdf' },
      'https://gihyo.jp/feed/atom',
      { key: 'jvn', url: 'https://jvn.jp/rss/jvn.rdf' }
    ]), context, client)
    expect(response).toStrictEqual({
      status: 400,
      body: '#2 entry is not an object\n#3 key "jvn" is duplicated'
    })
    expect(client.signals).toStrictEqual([])
  })

  it('should delete the entity on DELETE', async () => {
    const client = fakeClient({ 'previous:jvn': { url: 'u', links: [] } })
    const response = await handleMaintain(
      request('DELETE', 'previous:jvn'), context, client
    )
    expect(response).toStrictEqual({ body: 'accept' })
    expect(client.signals).toStrictEqual([
      { key: 'previous:jvn', op: 'delete', value: undefined }
    ])
  })

  it('should accept the legacy key on DELETE', async () => {
    const client = fakeClient({ previous: ['a'] })
    await handleMaintain(request('DELETE', 'previous'), context, client)
    expect(client.store.has('previous')).toBe(false)
  })

  it('should reject the legacy key on GET and POST', async () => {
    const client = fakeClient({ previous: ['a'] })
    for (const method of ['GET', 'POST']) {
      const response = await handleMaintain(
        request(method, 'previous', []), context, client
      )
      expect(response.status).toBe(400)
    }
    expect(client.reads).toStrictEqual([])
    expect(client.signals).toStrictEqual([])
  })
})
