'use strict';

const db = require('@arangodb').db;

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
