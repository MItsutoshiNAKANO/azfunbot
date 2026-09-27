/**
 * @file Send to LINE.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const { LineBotClient, HTTPFetchError } = require('@line/bot-sdk')

/**
 * Send the LINE message.
 * @param {[string]} lines Mail body.
 * @param {InvocationContext} context Azure Functions context.
 * @param {string} [to] Destination ID. Defaults to LINE_ID.
 * @see https://github.com/line/line-bot-sdk-nodejs/blob/master/docs/guide/client.md
 */
module.exports = async (lines, context, to = process.env.LINE_ID) => {
  let limit = process.env.DIFFRSS_MAX_CHAR_LIMIT ?? 5000
  const text = lines.filter((l) => (limit -= l.length + 2) > 0).join('\r\n')
  context.log({ lines: lines.length, length: text.length })
  if (text.length < 1) { return }

  const client = LineBotClient.fromChannelAccessToken({
    channelAccessToken: process.env.LINE_ACCESS_TOKEN
  })
  try {
    return await client.pushMessage({
      to, messages: [{ type: 'text', text }]
    })
  } catch (err) {
    context.error(err)
    if (err instanceof HTTPFetchError) {
      context.error({
        status: err.status, headers: err.headers, body: err.body
      })
    }
    throw err
  }
}
