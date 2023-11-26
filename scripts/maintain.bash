#! /bin/bash -eu
# SPDX-License-Identifier: AGPL-3.0-or-later
args=("$@")
case ${#args[@]} in
0) args=('schedule');;
esac
curl $(./scripts/urlalias.mjs ${args[@]})
