#! /usr/bin/env node

const sendMail = require('../lib/mail-sender')
try {
  sendMail(console, process.env.AZFUNBOT_MAIL_TO_ADMIN, 'test', 'テスト')
} catch (err) { console.error(err) }
