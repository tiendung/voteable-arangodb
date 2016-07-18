'use strict';
const db = require('@arangodb').db;
const collections = [
  "users",
  "articles",
  "votes", 		// an user vote(_from: users/1234, _to: articles/5678, type: up | down) an article
  "relations"   // user a has a relation(_from: users/1234, _to: users/2323, type: friend | married)
];

for (const name of collections) {
  db._drop(name);
}
