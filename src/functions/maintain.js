/**
 * @file Maintain Entities.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const { app } = require('@azure/functions')
const {
  durableClient, getClient, newEntityId, entityState, postEntity
} = require('../lib/entity')

/** Web Function.  */
app.http('maintain', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  extraInputs: [durableClient()],
  handler: async (request, context) => {
    context.log({ request })
    const key = request.query.get('key')
    context.log({ key })
    const client = getClient(context)
    const entityId = newEntityId(key)
    switch (request.method) {
      case 'GET':
        return { body: JSON.stringify(await entityState(client, entityId)) }
      case 'POST': {
        const posted = await request.json()
        context.log({ posted })
        await postEntity(posted, entityId, client)
        return { body: 'accept' }
      }
    }
  }
})
