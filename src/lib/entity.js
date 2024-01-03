/**
 * @file Entity.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const df = require('durable-functions')

const entityName = 'saver'
const lastRateError = 'lastRateError'
const previous = 'previous'
const schedule = 'schedule'
const urls = 'urls'
const keys = { lastRateError, previous, schedule, urls }

function durableClient () { return df.input.durableClient() }

function getClient (context) { return df.getClient(context) }

function newEntityId (key) {
  if (!keys[key]) { throw new ReferenceError(`"${key}" is not defined`) }
  return new df.EntityId(entityName, key)
}

async function entityState (client, id) {
  const response = await client.readEntityState(id)
  return response.entityState
}

/** Get the entity contents by the key.
 * @param {*} key Durable Function's Entity Key
 * @param {*} context Azure Functions context object
 * @returns key contents
 */
function entity (key, context) {
  const client = getClient(context)
  const id = newEntityId(key)
  return entityState(client, id)
}

function postEntity (value, entityId, client) {
  return client.signalEntity(entityId, 'post', value)
}

function postEntityByKey (value, key, context) {
  const client = getClient(context)
  const id = newEntityId(key)
  return { promise: postEntity(value, id, client), id, client }
}

module.exports = {
  durableClient,
  getClient,
  newEntityId,
  entityState,
  entity,
  postEntity,
  postEntityByKey,
  keys
}
