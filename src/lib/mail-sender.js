// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
/** Send a mail.
 * @see https://nodemailer.com/
 */
module.exports = async function (context, to, subject, text) {
  const nodemailer = require('nodemailer')

  const transporter = nodemailer.createTransport({
    host: process.env.AZFUNBOT_MAIL_HOST,
    port: process.env.AZFUNBOT_MAIL_PORT,
    secure: process.env.AZFUNBOT_MAIL_SECURE,
    auth: {
      user: process.env.AZFUNBOT_MAIL_AUTH_USER,
      pass: process.env.AZFUNBOT_MAIL_PASS
    }
  })

  const info = await transporter.sendMail({
    from: process.env.AZFUNBOT_MAIL_FROM, to, subject, text
  })

  context.log(`Sent: ${info.messageId}`)
}
