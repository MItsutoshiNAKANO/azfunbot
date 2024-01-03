/**
 * @file Differ feeds between yesterday and today.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const { app } = require('@azure/functions')
const { durableClient, entity, keys } = require('../lib/entity')
const canUseLine = require('../lib/can-use-line')
const watch = require('../lib/rss-watcher')

/** Registers diffRss Timer Function.  */
app.timer('diffRss', {
  schedule: process.env.DIFFRSS_SCHEDULE,
  extraInputs: [durableClient()],
  handler: async (myTimer, context) => {
    if (!canUseLine(context)) { return }
    /** URLs list.
     * @type string[]  */
    const urls = await entity(keys.urls, context)
    if (urls == null || urls.length < 1) { return }
    return watch(urls, myTimer, context)
  }
})
