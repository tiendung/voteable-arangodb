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

// Data seeding ...
var user1 = db.users.save({name: 'user1'});
var user2 = db.users.save({name: 'user2'});
var user3 = db.users.save({name: 'user3'});
var article1 = db.articles.save({title: 'article1'});
var article2 = db.articles.save({title: 'article2'});

var voting = require('../voting');

console.log('-- EMBED VOTE --');

console.log(`VOTING: ${user1._id} voteUp ${article1._id} ...`);
console.log(voting.embedVoteUp(user1._id, article1._id));

console.log(`VOTING: ${user1._id} voteDown ${article1._id} ...`);
console.log(voting.embedVoteDown(user1._id, article1._id));

console.log(`VOTING: ${user2._id} voteUp ${article1._id} ...`);
console.log(voting.embedVoteUp(user2._id, article1._id));

console.log(`VOTING: ${user3._id} voteDown ${article1._id} ...`);
console.log(voting.embedVoteDown(user3._id, article1._id));


console.log('-- EDGE VOTE --');

console.log(`VOTING: ${user1._id} voteUp ${article2._id} ...`);
console.log(voting.edgeVoteUp(user1._id, article2._id));

console.log(`VOTING: ${user1._id} voteDown ${article2._id} ...`);
console.log(voting.edgeVoteDown(user1._id, article2._id));

console.log(`VOTING: ${user2._id} voteUp ${article2._id} ...`);
console.log(voting.edgeVoteUp(user2._id, article2._id));

console.log(`VOTING: ${user3._id} voteDown ${article2._id} ...`);
console.log(voting.edgeVoteDown(user3._id, article2._id));



console.log('-- voteUp(), voteDown() VIA config() --');

// Config voting module
var myVoting = require('../voting').config({
  upVotePoint: 1,
  downVotePoint: -1,
  method: 'embed'
});

console.log(`VOTING: ${user3._id} voteUp ${article1._id} ...`);
console.log(myVoting.voteUp(user3._id, article1._id));

console.log(`VOTING: ${user3._id} voteDown ${article1._id} ...`);
console.log(myVoting.voteDown(user3._id, article1._id));
