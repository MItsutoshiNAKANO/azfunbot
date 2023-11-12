// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
/**
 * @see https://github.com/line/line-bot-sdk-nodejs/blob/master/docs/guide/client.md
 */
const MessagingApiClient = require('@line/bot-sdk').messagingApi.MessagingApiClient

module.exports = async (context, text) => {
  const lineClient = new MessagingApiClient({
    channelAccessToken: process.env.LINE_ACCESS_TOKEN
  })
  return lineClient.pushMessage(process.env.LINE_ID, {
    type: 'text', text
  }).catch(err => {
    context.error(err)
    throw err
  })
}
