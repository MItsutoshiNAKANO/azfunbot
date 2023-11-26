#! /usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
import { fileURLToPath } from 'url'
import path from 'path'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

const scriptPath = fileURLToPath(new URL(import.meta.url))
const dirname = path.dirname(scriptPath)
const basename = path.basename(scriptPath)
const argv = hideBin(process.argv)
const aliases = yargs(argv)
  .config({ extends: `${dirname}/../secrets/${basename}.config.json` }).argv
console.log(argv.map(a => aliases[a] || a).join(' '))
