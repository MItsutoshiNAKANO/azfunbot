/**
 * @file Entity.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const df = require('durable-functions')
const { FEED_KEY_PATTERN } = require('./feed-list')

const entityName = 'saver'
const lastRateError = 'lastRateError'
const schedule = 'schedule'
const urls = 'urls'
/** Fixed entity keys.  */
const keys = { lastRateError, schedule, urls }

/** Prefix of the per-feed keys that hold the links already seen.  */
const previousPrefix = 'previous:'

/** The old single key for the links already seen. It may only be deleted. */
const legacyPreviousKey = 'previous'

/** Pattern of the per-feed keys.  */
const previousKeyPattern = new RegExp(
  `^${previousPrefix}${FEED_KEY_PATTERN.source.slice(1)}`
)

function durableClient () { return df.input.durableClient() }

function getClient (context) { return df.getClient(context) }

/**
 * Build the entity key for a feed.
 * @param {string} feedKey User-defined key of the feed.
 * @returns {string} `previous:${feedKey}`
 */
function previousKey (feedKey) { return `${previousPrefix}${feedKey}` }

/**
 * Is the key allowed for reading and writing?
 * @param {*} key Entity key.
 * @returns {boolean} True if it is a fixed key or a per-feed key.
 */
function isValidKey (key) {
  return typeof key === 'string' &&
    (Object.hasOwn(keys, key) || previousKeyPattern.test(key))
}

/**
 * Create an entity ID for reading and writing.
 * @param {string} key Entity key.
 * @returns {df.EntityId} The entity ID.
 * @throws {ReferenceError} When the key is not allowed.
 */
function newEntityId (key) {
  if (!isValidKey(key)) { throw new ReferenceError(`"${key}" is not defined`) }
  return new df.EntityId(entityName, key)
}

/**
 * Create an entity ID for deletion.
 * It also accepts the legacy key "previous".
 * @param {string} key Entity key.
 * @returns {df.EntityId} The entity ID.
 * @throws {ReferenceError} When the key is not allowed.
 */
function newDeletableEntityId (key) {
  if (key === legacyPreviousKey) { return new df.EntityId(entityName, key) }
  return newEntityId(key)
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

/**
 * Ask the entity to delete itself.
 * @param {df.EntityId} entityId The entity ID.
 * @param {df.DurableClient} client Durable client.
 * @returns {Promise<void>} Resolves when the signal is sent.
 */
function deleteEntity (entityId, client) {
  return client.signalEntity(entityId, 'delete')
}

module.exports = {
  durableClient,
  getClient,
  previousKey,
  isValidKey,
  newEntityId,
  newDeletableEntityId,
  entityState,
  entity,
  postEntity,
  postEntityByKey,
  deleteEntity,
  keys,
  legacyPreviousKey
}
