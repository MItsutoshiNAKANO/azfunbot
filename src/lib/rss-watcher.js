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
  current.forEach((item) => { map.set(item.link, item) })
  previous.forEach((item) => { map.delete(item.link) })
  const diff = []
  map.forEach((item) => { diff.push(item) })
  context.log(`${diff.length} differs`)
  return diff
}

function head (chars, lines) {
  return lines.filter(line => {
    chars -= line.length + 2
    return chars > 0
  })
}

module.exports = async (urls, myTimer, context) => {
  // context.log({ urls, myTimer })
  const client = df.getClient(context)
  const entityId = new df.EntityId(entityName, 'previous')

  let current = []
  for (const url of urls) {
    const feed = await parser.parseURL(url)
    current = current.concat(feed.items.map(i => {
      const title = i.title
      const link = i.link
      return { link, title }
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
  await client.signalEntity(entityId, 'post', current)
  const text = head(5000, diff.map(i => `${i.link} ${i.title}`)).join('\r\n')
  const length = text.length
  context.log({ length })
  try {
    return await require('./send-line')(text)
  } catch (err) {
    context.error(err)
    throw err
  }
}
