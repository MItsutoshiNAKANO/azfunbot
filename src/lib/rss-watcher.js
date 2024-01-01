// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
const Parser = require('rss-parser')
const df = require('durable-functions')
const entityName = 'saver'

const parser = new Parser()

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

module.exports = async (urls, myTimer, context) => {
  // context.log({ urls, myTimer })
  const client = df.getClient(context)
  const entityId = new df.EntityId(entityName, 'previous')

  let current = []
  for (const url of urls) {
    const feed = await parser.parseURL(url)
    current = current.concat(feed.items.map(i => {
      return { link: i.link, title: i.title }
    }))
  }
  // context.log({ current })

  const response = await client.readEntityState(entityId)
  // context.log({ response })
  const previous = response.entityState
  // context.log({ previous })
  const diff = differ(current, previous, context)
  // context.log({ diff })
  if (diff.length < 1) {
    context.log('return void')
    return
  }
  const send = require('./send-line')
  await client.signalEntity(entityId, 'post', current.map((i) => i.link))
  return await send(diff.map(i => `${i.link} ${i.title}`), context)
}
