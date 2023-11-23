// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

module.exports = async (lines, context) => {
  let limit = Math.min(process.env.DIFFRSS_MAX_CHAR_LIMIT, 5000)
  const text = lines.filter((l) => (limit -= l.length + 2) > 0).join('\r\n')
  context.log({ lines: lines.length, length: text.length })
  if (text.length < 1) { return }
  /**
   * @see https://github.com/line/line-bot-sdk-nodejs/blob/master/docs/guide/client.md
   */
  const MessagingApiClient = require('@line/bot-sdk').messagingApi.MessagingApiClient
  return await new MessagingApiClient({
    channelAccessToken: process.env.LINE_ACCESS_TOKEN
  }).pushMessage({
    to: process.env.LINE_ID, messages: [{ type: 'text', text }]
  })
}
