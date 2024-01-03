/**
 * @file RSS feeds watcher.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const Parser = require('rss-parser')
const { getClient, newEntityId, entityState, postEntity, keys } =
require('./entity')
const send = require('./send-line')

/** Differ between current and previous feeds.
 * @param {[{ link: string, title: string }]} current currnet feed array
 * @param {[string]} previous previous feed array
 * @param {InvocationContext} context Azure Functions context
 * @returns {[{link: string, title: string}]} current - previous
 */
function differ (current, previous, context) {
  if (previous == null) {
    context.log('previous == null')
    return current
  }
  if (current == null) {
    context.warn('illegal current format')
    return []
  }
  context.log(`current: ${current.length}, previous: ${previous.length}`)
  const map = new Map()
  current.forEach((item) => { map.set(item.link, item.title) })
  previous.forEach((link) => { map.delete(link) })
  const diff = []
  map.forEach((title, link) => { diff.push({ link, title }) })
  context.log(`${diff.length} differs`)
  return diff
}

/** Parser instance.  */
const parser = new Parser()

/** Send new feeds to LINE.
 * @param {[string]} urls RSS
 * @param {*} myTimer
 * @param {InvocationContext} context Azure Functions context
 * @returns Line Message Response
 */
module.exports = async (urls, myTimer, context) => {
  context.log({ urls, myTimer })
  let current = []
  for (const url of urls) {
    const feed = await parser.parseURL(url)
    current = current.concat(feed.items.map(i => {
      return { link: i.link, title: i.title }
    }))
  }
  // context.log({ current })
  const client = getClient(context)
  const entityId = newEntityId(keys.previous)
  const previous = await entityState(client, entityId)
  // context.log({ previous })
  const diff = differ(current, previous, context)
  // context.log({ diff })
  if (diff.length < 1) {
    context.log('return void')
    return
  }
  await postEntity(current.map((i) => i.link), entityId, client)
  return await send(diff.map(i => `${i.link} ${i.title}`), context)
}
