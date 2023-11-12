// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
const df = require('durable-functions')

const entityName = 'saver'

df.app.entity(entityName, (context) => {
  let value
  switch (context.df.operationName) {
    case 'post':
      value = context.df.getInput()
      context.df.setState(value)
      break
    case 'get':
      value = context.df.getState(() => 0)
      context.df.return(value)
      break
  }
})
