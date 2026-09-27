/**
 * @file Maintain Entities.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict'
const { app } = require('@azure/functions')
const { durableClient, getClient } = require('../lib/entity')
const handleMaintain = require('../lib/maintain-handler')

/** Web Function.  */
app.http('maintain', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'function',
  extraInputs: [durableClient()],
  handler: async (request, context) => {
    context.log({ request })
    return await handleMaintain(request, context, getClient(context))
  }
})
