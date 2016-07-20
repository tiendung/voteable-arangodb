'use strict';
const db = require('@arangodb').db;
const documentCollections = [
  "users",
  "articles"
];
const edgeCollections = [
  "votes",
  "relations"
];

for (const name of documentCollections) {
  if (!db._collection(name)) {
    db._createDocumentCollection(name);
  } else if (module.context.isProduction) {
    console.warn(`collection ${name} already exists. Leaving it untouched.`);
  }
}

for (const name of edgeCollections) {
  if (!db._collection(name)) {
    db._createEdgeCollection(name);
  } else if (module.context.isProduction) {
    console.warn(`collection ${name} already exists. Leaving it untouched.`);
  }
}

// Indexing ...

// Create index to ensure a vote _from userId _to voteableObjId is unique
// https://docs.arangodb.com/3.0/Manual/Indexing/Hash.html#ensure-uniqueness-of-relations-in-edge-collections
db.votes.ensureIndex({ type: "hash", fields: [ "_from", "_to" ], unique: true });

// Create indexes for upVoterIds array and downVoterIds array
db.articles.ensureIndex({ type: "hash", fields: ["upVoterIds[*]"], sparse: true });
db.articles.ensureIndex({ type: "hash", fields: ["downVoterIds[*]"], sparse: true });
