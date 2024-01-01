// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
const { app } = require('@azure/functions')
const df = require('durable-functions')
const entityName = 'saver'

app.http('schedule', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  extraInputs: [df.input.durableClient()],
  handler: async (request, context) => {
    context.log(`${request.method} ${request.url}`)
    const client = df.getClient(context)
    context.log({ request })
    context.log({ request_query: request.query })
    const key = request.query.get('key') || 'schedule'
    context.log({ query_key: request.query.get('key') })
    context.log({ key })
    const entityId = new df.EntityId(entityName, key)
    switch (request.method) {
      case 'GET': {
        const response = await client.readEntityState(entityId)
        const schedule = response.entityState
        return { body: JSON.stringify(schedule) }
      }
      case 'POST': {
        const schedule = await request.json()
        await client.signalEntity(entityId, 'post', schedule)
        return { body: 'accept' }
      }
    }
  }
})
