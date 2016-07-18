#! /usr/bin/env bash
/Applications/ArangoDB-CLI.app/Contents/MacOS/foxx-manager teardown /voteable --server.database voteable_test --server.authentication false
/Applications/ArangoDB-CLI.app/Contents/MacOS/foxx-manager development /voteable --server.database voteable_test --server.authentication false
/Applications/ArangoDB-CLI.app/Contents/MacOS/foxx-manager setup /voteable --server.database voteable_test --server.authentication false
# /Applications/ArangoDB-CLI.app/Contents/MacOS/foxx-manager tests /voteable  --server.database voteable_test --server.authentication false
