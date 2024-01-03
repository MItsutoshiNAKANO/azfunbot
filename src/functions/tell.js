/**
 * @file Tell scheduled time.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const { app } = require('@azure/functions')
const {
  durableClient, getClient, newEntityId, entityState, postEntity, keys
} = require('../lib/entity')
const canUseLine = require('../lib/can-use-line')
const send = require('../lib/send-line')

/** Timer Azure Function.  */
app.timer('tell', {
  schedule: process.env.TELL_SCHEDULE,
  extraInputs: [durableClient()],
  handler: async (myTimer, context) => {
    const client = getClient(context)
    const entityId = newEntityId(keys.schedule)
    const schedule = await entityState(client, entityId)
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
    await postEntity(newSchedule, entityId, client)
    if (!await canUseLine(context)) { return }
    return await send(text, context)
  }
})
