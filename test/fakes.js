/**
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * @file Test doubles shared by the tests.
 */

import { vi } from 'vitest'

/**
 * A durable client that keeps entity states in memory.
 * @typedef {Object} FakeClient
 * @property {Map<string, *>} store Entity states by key.
 * @property {string[]} reads Keys that were read.
 * @property {{key: string, op: string, value: *}[]} signals Signals sent.
 * @property {function(*): Promise<{entityExists: boolean, entityState: *}>}
 *   readEntityState Read an entity state.
 * @property {function(*, string, *=): Promise<void>} signalEntity
 *   Signal an entity.
 */

/**
 * Create a {@link FakeClient}.
 * @param {Object<string, *>} [initial] Initial entity states by key.
 * @returns {FakeClient} The client.
 */
export function fakeClient (initial = {}) {
  const store = new Map(Object.entries(initial))
  const reads = []
  const signals = []
  return {
    store,
    reads,
    signals,
    async readEntityState (id) {
      reads.push(id.key)
      return { entityExists: store.has(id.key), entityState: store.get(id.key) }
    },
    async signalEntity (id, op, value) {
      signals.push({ key: id.key, op, value })
      if (op === 'post') { store.set(id.key, value) }
      if (op === 'delete') { store.delete(id.key) }
    }
  }
}

/**
 * Create an Azure Functions context whose log methods are spies.
 * @returns {{log: Function, warn: Function, error: Function}} The context.
 */
export function fakeContext () {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
}
