#! /bin/bash -eu

dir=$(dirname "$0")
cd "$dir"
source "../secrets/test-mail-sender.rc.sh"

node "./test-mail-sender.js" "$@"
