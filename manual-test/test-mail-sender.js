#! /usr/bin/env node
/** SPDX-License-Identifier: AGPL-3.0-or-later   */
'use strict'
const sendMail = require('../src/lib/mail-sender')
try {
  sendMail(console, process.env.AZFUNBOT_MAIL_TO_ADMIN, 'test', 'テスト')
} catch (err) { console.error(err) }
