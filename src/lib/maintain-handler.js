/**
 * @file Handle requests to the maintain API.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const {
  newEntityId, newDeletableEntityId, entityState, postEntity, deleteEntity,
  keys
} = require('./entity')
const { validateFeedList, describeSkipped } = require('./feed-list')

/**
 * Read, write or delete the entity named by the "key" query parameter.
 * - GET returns the contents as JSON.
 * - POST replaces the contents with the request body.
 *   The "urls" entity is validated first.
 * - DELETE deletes the entity. It also accepts the legacy key "previous".
 * @param {import('@azure/functions').HttpRequest} request HTTP request.
 * @param {import('@azure/functions').InvocationContext} context
 *   Azure Functions context.
 * @param {*} client Durable client.
 * @returns {Promise<import('@azure/functions').HttpResponseInit>} Response.
 */
async function handleMaintain (request, context, client) {
  const key = request.query.get('key')
  context.log({ key })
  let entityId
  try {
    entityId = request.method === 'DELETE'
      ? newDeletableEntityId(key)
      : newEntityId(key)
  } catch (err) {
    return { status: 400, body: err.message }
  }
  switch (request.method) {
    case 'GET':
      return { body: JSON.stringify(await entityState(client, entityId)) }
    case 'POST': {
      let posted
      try {
        posted = await request.json()
      } catch (err) {
        return { status: 400, body: `Invalid JSON: ${err.message}` }
      }
      context.log({ posted })
      if (key === keys.urls) {
        const { skipped } = validateFeedList(posted)
        if (skipped.length > 0) {
          return { status: 400, body: skipped.map(describeSkipped).join('\n') }
        }
      }
      await postEntity(posted, entityId, client)
      return { body: 'accept' }
    }
    case 'DELETE':
      await deleteEntity(entityId, client)
      return { body: 'accept' }
    default:
      return { status: 405, body: `Method ${request.method} is not allowed` }
  }
}

module.exports = handleMaintain
