/**
 * @file Send to LINE.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const { messagingApi, HTTPError } = require('@line/bot-sdk')
const sendMail = require('./mail-sender')
const { postEntityByKey, keys } = require('./entity')

/**
 * Send the LINE message.
 * @param {[string]} lines Mail body.
 * @param {InvocationContext} context Azure Functions context.
 * @see https://github.com/line/line-bot-sdk-nodejs/blob/master/docs/guide/client.md
 */
module.exports = async (lines, context) => {
  let limit = Math.min(process.env.DIFFRSS_MAX_CHAR_LIMIT, 5000)
  const text = lines.filter((l) => (limit -= l.length + 2) > 0).join('\r\n')
  context.log({ lines: lines.length, length: text.length })
  if (text.length < 1) { return }
  const MessagingApiClient = messagingApi.MessagingApiClient
  try {
    return await new MessagingApiClient({
      channelAccessToken: process.env.LINE_ACCESS_TOKEN
    }).pushMessage({
      to: process.env.LINE_ID, messages: [{ type: 'text', text }]
    })
  } catch (err) {
    context.error(err)
    try {
      sendMail(context, process.env.AZFUNBOT_MAIL_TO_ADMIN,
        'LINE was failed', err)
    } catch (mailErr) { context.error(mailErr) }
    if (err instanceof HTTPError && err.statusCode === 429) {
      await postEntityByKey(new Date(), keys.lastRateError, context)
    }
    throw err
  }
}
