// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
/**
 * @see https://github.com/line/line-bot-sdk-nodejs/blob/master/docs/guide/client.md
 */
const MessagingApiClient = require('@line/bot-sdk').messagingApi.MessagingApiClient
module.exports = async (text) => new MessagingApiClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
}).pushMessage({
  to: process.env.LINE_ID, messages: [{ type: 'text', text }]
})
