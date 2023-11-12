// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
const { app } = require('@azure/functions')
const df = require('durable-functions')
const watch = require('../lib/rss-watcher.js')

app.timer('diffRss', {
  schedule: process.env.DIFFRSS_SCHEDULE,
  extraInputs: [df.input.durableClient()],
  handler: (myTimer, context) => {
    const URLS = [
      'https://www.ipa.go.jp/security/alert-rss.rdf',
      'https://jvn.jp/rss/jvn.rdf',
      'https://gihyo.jp/feed/atom',
      'http://feeds.japan.zdnet.com/rss/zdnet/all.rdf',
      'https://rss.itmedia.co.jp/rss/2.0/ait.xml',
      'https://rss.itmedia.co.jp/rss/2.0/keymans.xml',
      'https://rss.itmedia.co.jp/rss/2.0/techtarget.xml',
      'https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml',
      'https://www.watch.impress.co.jp/data/rss/1.0/ipw/feed.rdf'
    ]
    return watch(URLS, myTimer, context)
  }
})
