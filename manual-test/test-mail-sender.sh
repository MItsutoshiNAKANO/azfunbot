#! /bin/bash -eu
#* SPDX-License-Identifier: AGPL-3.0-or-later
dir=$(dirname "$0")
cd "$dir"
source "../secrets/test-mail-sender.rc.sh"

node "./test-mail-sender.js" "$@"
