#! /usr/bin/env bash
foxx-manager development /voteable --server.database voteable_development --server.authentication false
foxx-manager production /voteable --server.database voteable_test --server.authentication false
