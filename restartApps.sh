#! /usr/bin/env bash
/Applications/ArangoDB-CLI.app/Contents/MacOS/foxx-manager development /voteable --server.database voteable_development --server.authentication false

/Applications/ArangoDB-CLI.app/Contents/MacOS/foxx-manager production /voteable --server.database voteable_test --server.authentication false
