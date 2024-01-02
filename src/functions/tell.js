/**
 * @file Tell scheduled time.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const { app } = require('@azure/functions')
const df = require('durable-functions')
const entityName = 'saver'

/** Timer Azure Function.  */
app.timer('tell', {
  schedule: process.env.TELL_SCHEDULE,
  extraInputs: [df.input.durableClient()],
  handler: async (myTimer, context) => {
    const client = df.getClient(context)
    const entityId = new df.EntityId(entityName, 'schedule')
    const response = await client.readEntityState(entityId)
    const schedule = response.entityState
    if (schedule == null || schedule.length < 1) {
      context.log('The schedule is null')
      return
    }
    const now = new Date()
    const text = []
    const newSchedule = schedule.map((i) => {
      const times = i.times.filter((t) => Date.parse(t) > now)
      if (times.length >= i.times.length) { return i }
      text.push(i.text)
      return { times, text: i.text }
    })
    if (text.length < 1) {
      context.log('The schedule is 0')
      return
    }
    const send = require('../lib/send-line')
    await client.signalEntity(entityId, 'post', newSchedule)
    return await send(text, context)
  }
})
