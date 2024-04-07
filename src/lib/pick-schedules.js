/**
 * @file Pick schedules.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const evaljson = require('evaljson')

/**
 * Eval macros.
 * @param {JSON} json Object.
 * @param {Date} today Date.
 * @param {string} locale Locale.
 * @param {Object} options Locale options.
 * @returns {JSON} Evaluated json.
 */
function evalMacros (json, today, locale, options) {
  const tomorrow = new Date(
    today.getFullYear(), today.getMonth(), today.getDate() + 1)
  return evaljson(json, {
    tomorrow: tomorrow.toLocaleDateString(locale, options),
    today: today.toLocaleDateString(locale, options)
  })
}

/**
 * Pick up schedules.
 * @param {JSON} schedules Schedule array.
 * @param {Date} now Date.
 * @param {string} locale Locale.
 * @param {Object} options Locale options.
 * @returns Evaluated text and new schedule.
 */
module.exports = function (schedules, now, locale, options) {
  const text = []
  const newSchedule = schedules.map((i) => {
    const times = i.times.filter((t) => Date.parse(t) > now)
    if (times.length >= i.times.length) { return i }
    text.push(i.text)
    return { times, text: i.text }
  })
  return { text: evalMacros(text, now, locale, options), newSchedule }
}
