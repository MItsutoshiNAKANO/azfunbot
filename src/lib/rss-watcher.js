/**
 * @file RSS feeds watcher.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * @see ../../docs/specs/diffrss-partial-failure.md
 */
'use strict'
const Parser = require('rss-parser')
const {
  getClient, newEntityId, entityState, postEntity, previousKey
} = require('./entity')
const {
  validateFeedList, findDuplicateUrls, describeSkipped
} = require('./feed-list')
const sendLine = require('./send-line')

/** Default timeout for fetching one feed, in milliseconds.  */
const DEFAULT_FETCH_TIMEOUT_MILLI_SEC = 30000

/**
 * A feed item to notify.
 * @typedef {Object} FeedItem
 * @property {string} link URL of the item.
 * @property {string} [title] Title of the item.
 */

/**
 * The links already seen, saved as `previous:${key}`.
 * @typedef {Object} FeedState
 * @property {string} url URL of the feed when it was saved.
 * @property {string[]} links Links of the items.
 */

/**
 * A feed that could not be fetched.
 * @typedef {Object} FetchFailure
 * @property {import('./feed-list').Feed} feed The feed.
 * @property {string} reason Why it failed, in US English.
 * @property {*} error The original error.
 */

/**
 * What to do with one fetched feed.
 * @typedef {Object} FeedPlan
 * @property {FeedItem[]} newItems Items to notify.
 * @property {?FeedState} value State to save, or null to keep the saved one.
 * @property {boolean} firstTime True if there was no usable saved state.
 * @property {boolean} invalidState True if the saved state was malformed.
 * @property {boolean} urlChanged True if the saved URL differs.
 * @property {string} [previousUrl] The saved URL.
 */

/**
 * Optional dependencies of {@link watch}, mainly for tests.
 * @typedef {Object} WatchDependencies
 * @property {*} [client] Durable client.
 * @property {{parseURL: function(string): Promise<*>}} [parser] Feed parser.
 * @property {function(string[], *, string=): Promise<*>} [send] LINE sender.
 * @property {Object<string, string>} [env] Environment variables.
 */

/**
 * Read the fetch timeout from the environment.
 * @param {Object<string, string>} env Environment variables.
 * @returns {number} Timeout in milliseconds.
 */
function fetchTimeout (env) {
  const value = Number(env.DIFFRSS_FETCH_TIMEOUT_MILLI_SEC)
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_FETCH_TIMEOUT_MILLI_SEC
}

/**
 * Create a feed parser.
 * @param {number} timeout Timeout in milliseconds.
 * @returns {Parser} The parser.
 */
function createParser (timeout) { return new Parser({ timeout }) }

/**
 * Describe why fetching a feed failed.
 * rss-parser has no error types, so this classifies the error by its message:
 * "Status code N" is an HTTP error, "Request timed out" is a timeout,
 * errors with a system error code are network errors,
 * and everything else is a parse error.
 * @param {*} error The error from rss-parser.
 * @param {number} timeout Timeout in milliseconds.
 * @returns {string} The reason, in US English.
 */
function describeFetchError (error, timeout) {
  const message = error?.message ?? String(error)
  const status = /^Status code (\d+)/.exec(message)
  if (status) { return `HTTP ${status[1]}` }
  if (/^Request timed out/.test(message)) {
    return `timed out after ${timeout} ms`
  }
  if (error?.code || message === 'Too many redirects') { return message }
  return `parse error: ${message}`
}

/**
 * Extract items with a link from a parsed feed, without duplicated links.
 * @param {*} feed The parsed feed.
 * @returns {FeedItem[]} The items.
 */
function toItems (feed) {
  const seen = new Set()
  const items = []
  for (const { link, title } of feed?.items ?? []) {
    if (typeof link !== 'string' || seen.has(link)) { continue }
    seen.add(link)
    items.push({ link, title })
  }
  return items
}

/**
 * Is the value a well-formed {@link FeedState}?
 * @param {*} state The saved value.
 * @returns {boolean} True if it is well-formed.
 */
function isFeedState (state) {
  return state !== null && typeof state === 'object' &&
    typeof state.url === 'string' && Array.isArray(state.links) &&
    state.links.every((link) => typeof link === 'string')
}

/**
 * Do the two arrays hold the same set of strings?
 * @param {string[]} a An array.
 * @param {string[]} b Another array.
 * @returns {boolean} True if the sets are equal.
 */
function sameSet (a, b) {
  const setA = new Set(a)
  const setB = new Set(b)
  return setA.size === setB.size && [...setA].every((x) => setB.has(x))
}

/**
 * Decide what to notify and what to save for one fetched feed.
 * @param {import('./feed-list').Feed} feed The feed.
 * @param {FeedItem[]} items The fetched items.
 * @param {*} state The saved state, or undefined if there is none.
 * @returns {FeedPlan} The plan.
 */
function planFeed (feed, items, state) {
  const value = { url: feed.url, links: items.map((item) => item.link) }
  const invalidState = state != null && !isFeedState(state)
  if (state == null || invalidState) {
    return {
      newItems: [], value, firstTime: true, invalidState, urlChanged: false
    }
  }
  const seen = new Set(state.links)
  const newItems = items.filter((item) => !seen.has(item.link))
  const urlChanged = state.url !== feed.url
  const unchanged = !urlChanged && sameSet(value.links, state.links)
  return {
    newItems,
    value: unchanged ? null : value,
    firstTime: false,
    invalidState: false,
    urlChanged,
    previousUrl: state.url
  }
}

/**
 * Build the message for the administrator.
 * @param {Object} report What went wrong.
 * @param {FetchFailure[]} report.failures Feeds that could not be fetched.
 * @param {import('./feed-list').SkippedEntry[]} report.skipped Skipped entries.
 * @param {boolean} [report.noValidFeeds] True if no feed is valid.
 * @returns {string[]} Lines of the message.
 */
function buildAdminReport ({ failures, skipped, noValidFeeds = false }) {
  const header = noValidFeeds
    ? '[AzFunBot] diffRss: no valid feeds in "urls"'
    : `[AzFunBot] diffRss: ${failures.length} failed, ${skipped.length} skipped`
  return [
    header,
    ...failures.map(({ feed, reason }) =>
      `Failed: ${feed.key} ${feed.url} ${reason}`),
    ...skipped.map((entry) => `Skipped: ${describeSkipped(entry)}`)
  ]
}

/**
 * Send the message to the administrator.
 * It never throws, so that it does not affect the main notification.
 * @param {string[]} lines Lines of the message.
 * @param {*} context Azure Functions context.
 * @param {function(string[], *, string=): Promise<*>} send LINE sender.
 * @param {Object<string, string>} env Environment variables.
 * @returns {Promise<void>} Resolves when done.
 */
async function notifyAdmin (lines, context, send, env) {
  const to = env.LINE_ADMIN_ID
  if (!to) {
    context.log('LINE_ADMIN_ID is not set; skipped admin notification')
    return
  }
  try {
    await send(lines, context, to)
  } catch (err) {
    context.error(`Failed to notify admin: ${err?.message ?? err}`)
  }
}

/**
 * Describe a skipped entry for the log.
 * @param {import('./feed-list').SkippedEntry} entry The skipped entry.
 * @returns {string} The log message.
 */
function skippedLogMessage ({ position, reason }) {
  return position == null
    ? `Skipped urls: ${reason}`
    : `Skipped urls entry #${position}: ${reason}`
}

/**
 * Fetch the feeds, send new items to LINE and save the links already seen.
 * A feed that cannot be fetched is skipped and reported to the administrator.
 * @param {*} entries Contents of the "urls" entity.
 * @param {*} context Azure Functions context.
 * @param {WatchDependencies} [deps] Dependencies to override.
 * @returns {Promise<void>} Resolves when done.
 * @throws {AggregateError} When every valid feed failed to fetch.
 */
async function watch (entries, context, deps = {}) {
  const env = deps.env ?? process.env
  const timeout = fetchTimeout(env)
  const client = deps.client ?? getClient(context)
  const parser = deps.parser ?? createParser(timeout)
  const send = deps.send ?? sendLine

  const { feeds, skipped } = validateFeedList(entries)
  skipped.forEach((entry) => context.warn(skippedLogMessage(entry)))
  for (const { url, keys } of findDuplicateUrls(feeds)) {
    context.warn(`Duplicate url ${url} for keys ${keys.join(', ')}`)
  }
  if (feeds.length < 1) {
    context.error('No valid feeds in "urls"')
    await notifyAdmin(
      buildAdminReport({ failures: [], skipped, noValidFeeds: true }),
      context, send, env
    )
    return
  }

  const results = await Promise.allSettled(
    feeds.map((feed) => parser.parseURL(feed.url))
  )
  /** @type {{feed: import('./feed-list').Feed, items: FeedItem[]}[]} */
  const fetched = []
  /** @type {FetchFailure[]} */
  const failures = []
  results.forEach((result, index) => {
    const feed = feeds[index]
    if (result.status === 'fulfilled') {
      fetched.push({ feed, items: toItems(result.value) })
      return
    }
    const reason = describeFetchError(result.reason, timeout)
    failures.push({ feed, reason, error: result.reason })
    context.warn(`Failed to fetch ${feed.key} ${feed.url}: ${reason}`)
  })

  const ids = fetched.map(({ feed }) => newEntityId(previousKey(feed.key)))
  const states = await Promise.all(ids.map((id) => entityState(client, id)))
  /** @type {FeedItem[]} */
  const newItems = []
  const writes = []
  let firstTime = 0
  fetched.forEach(({ feed, items }, index) => {
    const plan = planFeed(feed, items, states[index])
    if (plan.invalidState) {
      context.warn(
        `Invalid state for ${previousKey(feed.key)}; treating as first fetch`
      )
    }
    if (plan.firstTime) {
      firstTime++
      context.log(`First fetch for ${feed.key}; ` +
        `saved ${plan.value.links.length} links without notifying`)
    }
    if (plan.urlChanged) {
      context.log(`Feed url for ${feed.key} changed ` +
        `from ${plan.previousUrl} to ${feed.url}`)
    }
    newItems.push(...plan.newItems)
    if (plan.value) { writes.push(postEntity(plan.value, ids[index], client)) }
  })
  await Promise.all(writes)

  try {
    if (newItems.length > 0) {
      await send(newItems.map(({ link, title }) =>
        `${link} ${title ?? ''}`.trimEnd()), context)
    }
  } finally {
    if (failures.length > 0 || skipped.length > 0) {
      await notifyAdmin(buildAdminReport({ failures, skipped }),
        context, send, env)
    }
    context.log(`diffRss summary: ${fetched.length} succeeded, ` +
      `${failures.length} failed, ${skipped.length} skipped, ` +
      `${firstTime} first-time, ${newItems.length} new items, ` +
      `${writes.length} writes`)
  }
  if (fetched.length < 1) {
    throw new AggregateError(
      failures.map(({ error }) => error), 'All feeds failed to fetch'
    )
  }
}

module.exports = {
  DEFAULT_FETCH_TIMEOUT_MILLI_SEC,
  fetchTimeout,
  createParser,
  describeFetchError,
  toItems,
  planFeed,
  buildAdminReport,
  notifyAdmin,
  watch
}
