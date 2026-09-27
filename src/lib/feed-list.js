/**
 * @file Validate the contents of the "urls" entity.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'

/**
 * Pattern that a feed key must match.
 * The entity instance ID becomes `@saver@previous:${key}`,
 * which must fit in 100 characters and must be safe in a URL path.
 */
const FEED_KEY_PATTERN = /^[A-Za-z0-9_-]{1,84}$/

/**
 * A valid feed entry.
 * @typedef {Object} Feed
 * @property {string} key User-defined key of the feed.
 * @property {string} url URL of the feed.
 * @property {number} position 1-based position in the "urls" array.
 */

/**
 * An entry that was rejected by the validation.
 * @typedef {Object} SkippedEntry
 * @property {?number} position 1-based position in the "urls" array,
 *   or null when the whole value is rejected.
 * @property {string} reason Why the entry was rejected, in US English.
 */

/**
 * Check one entry except for key duplication.
 * @param {*} entry An element of the "urls" array.
 * @returns {?string} The reason if the entry is invalid, otherwise null.
 */
function checkEntry (entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return 'entry is not an object'
  }
  const { key, url } = entry
  if (typeof key !== 'string') { return 'key is missing or not a string' }
  if (!FEED_KEY_PATTERN.test(key)) {
    return `key "${key}" must match ${FEED_KEY_PATTERN.source}`
  }
  if (typeof url !== 'string') { return 'url is missing or not a string' }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return `url "${url}" is not an absolute URL`
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `url "${url}" must use http or https`
  }
  return null
}

/**
 * Split the "urls" entity into valid feeds and skipped entries.
 * When a key is duplicated, the first entry wins.
 * @param {*} entries Contents of the "urls" entity.
 * @returns {{feeds: Feed[], skipped: SkippedEntry[]}} Validation result.
 */
function validateFeedList (entries) {
  if (!Array.isArray(entries)) {
    return { feeds: [], skipped: [{ position: null, reason: '"urls" is not an array' }] }
  }
  /** @type {Feed[]} */
  const feeds = []
  /** @type {SkippedEntry[]} */
  const skipped = []
  const seen = new Set()
  entries.forEach((entry, index) => {
    const position = index + 1
    const reason = checkEntry(entry)
    if (reason) {
      skipped.push({ position, reason })
    } else if (seen.has(entry.key)) {
      skipped.push({ position, reason: `key "${entry.key}" is duplicated` })
    } else {
      seen.add(entry.key)
      feeds.push({ key: entry.key, url: entry.url, position })
    }
  })
  return { feeds, skipped }
}

/**
 * Find URLs that are registered under more than one key.
 * @param {Feed[]} feeds Valid feeds.
 * @returns {{url: string, keys: string[]}[]} Duplicated URLs and their keys.
 */
function findDuplicateUrls (feeds) {
  /** @type {Map<string, string[]>} */
  const byUrl = new Map()
  for (const { key, url } of feeds) {
    byUrl.set(url, [...(byUrl.get(url) ?? []), key])
  }
  const duplicates = []
  byUrl.forEach((keys, url) => {
    if (keys.length > 1) { duplicates.push({ url, keys }) }
  })
  return duplicates
}

/**
 * Describe a skipped entry, e.g. `#4 key "a/b" must match ...`.
 * @param {SkippedEntry} skipped The skipped entry.
 * @returns {string} The description.
 */
function describeSkipped ({ position, reason }) {
  return position == null ? reason : `#${position} ${reason}`
}

module.exports = {
  FEED_KEY_PATTERN,
  validateFeedList,
  findDuplicateUrls,
  describeSkipped
}
