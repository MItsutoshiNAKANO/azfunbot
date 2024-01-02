/**
 * @file Entity Durable Function.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const df = require('durable-functions')

/** Durable Entity Function.  */
df.app.entity('saver', (context) => {
  switch (context.df.operationName) {
    case 'post': {
      /** Content from the remote.  */
      const value = context.df.getInput()
      context.df.setState(value)
      break
    }
    case 'get': {
      /** Content from Entity Durable Function.  */
      const value = context.df.getState(() => 0)
      context.df.return(value)
      break
    }
  }
})
