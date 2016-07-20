#! /usr/bin/env bash
foxx-manager teardown /voteable --server.database voteable_test --server.authentication false
foxx-manager development /voteable --server.database voteable_test --server.authentication false
foxx-manager setup /voteable --server.database voteable_test --server.authentication false
foxx-manager tests /voteable  --server.database voteable_test --server.authentication false
