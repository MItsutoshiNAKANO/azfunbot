/**
 * @file Can I already send to LINE?
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const { entity, keys } = require('./entity')

module.exports = async (context) => {
  /** The time when LINE Messageing API responsed HTTP 429 error.
   * @type Date  */
  const lastRateError = await entity(keys.lastRateError, context)
  context.log({ last: lastRateError })
  if (!lastRateError) { return Date.now() }
  const diff = Date.now() - Date.parse(lastRateError)
  if (diff <= process.env.AZFUNBOT_WAIT_ERROR * 24 * 60 * 60 * 1000) {
    return 0
  }
  return diff
}
