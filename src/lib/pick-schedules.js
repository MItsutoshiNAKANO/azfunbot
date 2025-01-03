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
    today.getFullYear(), today.getMonth(), today.getDate() + 1
  )
  const theDayAfterTomorrow = new Date(
    today.getFullYear(), today.getMonth(), today.getDate() + 2
  )
  const in3Days = new Date(
    today.getFullYear(), today.getMonth(), today.getDate() + 3
  )
  const in4Days = new Date(
    today.getFullYear(), today.getMonth(), today.getDate() + 4
  )
  const in5Days = new Date(
    today.getFullYear(), today.getMonth(), today.getDate() + 5
  )
  const in6Days = new Date(
    today.getFullYear(), today.getMonth(), today.getDate() + 6
  )
  const inAWeek = new Date(
    today.getFullYear(), today.getMonth(), today.getDate() + 7
  )
  const day = today.getDay()
  const lastSunday = new Date(
    today.getFullYear(), today.getMonth(), today.getDate() - day
  )
  const Sunday = new Date(
    lastSunday.getFullYear(), lastSunday.getMonth(), lastSunday.getDate() + 7
  )
  const Monday = (day < 1
    ? new Date(
      lastSunday.getFullYear(), lastSunday.getMonth(),
      lastSunday.getDate() + 1
    )
    : new Date(
      Sunday.getFullYear(), Sunday.getMonth(),
      Sunday.getDate() + 1)
  )
  const Tuesday = (day < 2
    ? new Date(
      lastSunday.getFullYear(), lastSunday.getMonth(),
      lastSunday.getDate() + 2
    )
    : new Date(Sunday.getFullYear(), Sunday.getMonth(), Sunday.getDate() + 2)
  )
  const Wednesday = (day < 3
    ? new Date(
      lastSunday.getFullYear(), lastSunday.getMonth(),
      lastSunday.getDate() + 3
    )
    : new Date(Sunday.getFullYear(), Sunday.getMonth(), Sunday.getDate() + 3)
  )
  const Thursday = (day < 4
    ? new Date(
      lastSunday.getFullYear(), lastSunday.getMonth(),
      lastSunday.getDate() + 4
    )
    : new Date(Sunday.getFullYear(), Sunday.getMonth(), Sunday.getDate() + 4)
  )
  const Friday = (day < 5
    ? new Date(
      lastSunday.getFullYear(), lastSunday.getMonth(),
      lastSunday.getDate() + 5
    )
    : new Date(Sunday.getFullYear(), Sunday.getMonth(), Sunday.getDate() + 5)
  )
  const Saturday = (day < 6
    ? new Date(
      lastSunday.getFullYear(), lastSunday.getMonth(),
      lastSunday.getDate() + 6
    )
    : new Date(Sunday.getFullYear(), Sunday.getMonth(), Sunday.getDate() + 6)
  )
  return evaljson(json, {
    today: today.toLocaleDateString(locale, options),
    tomorrow: tomorrow.toLocaleDateString(locale, options),
    theDayAfterTomorrow: theDayAfterTomorrow.toLocaleDateString(
      locale, options
    ),
    in3Days: in3Days.toLocaleDateString(locale, options),
    in4Days: in4Days.toLocaleDateString(locale, options),
    in5Days: in5Days.toLocaleDateString(locale, options),
    in6Days: in6Days.toLocaleDateString(locale, options),
    inAWeek: inAWeek.toLocaleDateString(locale, options),
    lastSunday: lastSunday.toLocaleDateString(locale, options),
    Sunday: Sunday.toLocaleDateString(locale, options),
    Monday: Monday.toLocaleDateString(locale, options),
    Tuesday: Tuesday.toLocaleDateString(locale, options),
    Wednesday: Wednesday.toLocaleDateString(locale, options),
    Thursday: Thursday.toLocaleDateString(locale, options),
    Friday: Friday.toLocaleDateString(locale, options),
    Saturday: Saturday.toLocaleDateString(locale, options)
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
