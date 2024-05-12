#! /usr/bin/env node
'use strict'
/**
 * @file Maintain AzFunBot.
 * @license AGPL-3.0-or-later
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * @description
 *   example:
 *      ./scripts/maintain.mjs -D - -X POST --json @secrets/schedule.json 'localtest:?key=schedule'
 *      ./scripts/maintain.mjs -D - -X POST --json @secrets/schedule.json 'maintain:?code=&key=schedule'
 */
/** @see https://nodejs.org/docs/latest-v20.x/api/child_process.html  */
import { spawn } from 'node:child_process'
import { exit } from 'node:process'
import path from 'path'
import { fileURLToPath } from 'url'
/** @see https://github.com/yargs/yargs/  */
import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'

const scriptPath = fileURLToPath(new URL(import.meta.url))
const dirname = path.dirname(scriptPath)
const basename = path.basename(scriptPath)
const args = hideBin(process.argv)
const curlArgs = args.filter((_val, index) => index < args.length - 1)
const str = args[args.length - 1]
const parsed = yargs([str]).config({
  extends: `${dirname}/../secrets/${basename}.config.json`
}).argv
const aliases = []
for (const [key, value] of Object.entries(parsed)) {
  if (key !== '_' && key !== '$0') { aliases.push([key, value]) }
}
const urls = parsed._.map(a => {
  for (const [key, value] of aliases) { a = a.replace(key, value) }
  return a
})
const commandLine = ['curl', curlArgs.concat(urls)]
console.warn(commandLine)
const curl = spawn(...commandLine)
curl.stdout.on('data', data => console.log(`${data}`))
curl.stderr.on('data', data => console.error(`${data}`))
curl.on('close', code => exit(code))
