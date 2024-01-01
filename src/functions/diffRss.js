// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
const { app } = require('@azure/functions')
const df = require('durable-functions')
const watch = require('../lib/rss-watcher')
const entityName = 'saver'

async function entity (key, context) {
  const client = df.getClient(context)
  const entityId = new df.EntityId(entityName, key)
  const response = await client.readEntityState(entityId)
  return response.entityState
}

app.timer('diffRss', {
  schedule: process.env.DIFFRSS_SCHEDULE,
  extraInputs: [df.input.durableClient()],
  handler: async (myTimer, context) => {
    const lastRateError = await entity('lastRateError', context)
    if (lastRateError &&
      Date.now() - lastRateError.getTime() <=
      process.env.AZFUNBOT_WAIT_ERROR * 24 * 60 * 60 * 1000) { return }
    const urls = await entity('urls', context)
    if (urls == null || urls.length < 1) { return }
    return watch(urls, myTimer, context)
  }
})
