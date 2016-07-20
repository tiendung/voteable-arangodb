# Voteable ArangoDB

Implement up / down voting solutions in Foxx using both embedded arrays and edgeCollection and compare pros and cons of them. 

Those two voting algorithms are implemented as `embedVote` function and `edgeVote` function in `voting.js`

**TODO**
* [ ] Add unit tests to ensure correctness of `embedVote` and `edgeVote`
* [ ] Create HTTP APIs to do to test Foxx performance and stability in real-life situations
* [ ] Test performance of `embedVote` vs `edgeVote` to see advantage and trade-off of both methods
* [ ] Re-implement `embedVote` and/or `edgeVote` in node.js + ArangoDB to compare performance between Foxx and node.js + db adapter
* [ ] Re-implement `embedVote` and/or `edgeVote` in node.js + MongoDB to compare performance among node.js + ArangoDB, Foxx + ArangoDB and node.js + MongoDB

### embedVote
`embedVote` uses `upVoterIds` and `downVoterIds` to store vote data in-side the voteableObject so it can 
do voting and return tabulated data with-in single db query. Should be more efficient when number of votes per voteableObject is around hundereds or few thounsands? (need to do performance tests to find out)

**PROS**
 * Do voting in only ONE db query
 * Generate tabulated data on-the-fly (no need to store additional tabulated data fields (upVotesCount, downVotesCount, totalVotePoint) inside voteableObject)

**CONS**
 * Need to create indexes `upVoterIds` and `downVoterIds` for every voteableCollections and do multiple queries in order to find out all voteableObjectIds a user voted before
 * Cannot store history data like createdAt, updatedAt timestamps
 * Cannot use graph alorithm to do recommendation. For example: show me few articles that are got most of up vote from my friends
 * Not efficient when number of votes for each objects is huge (thousands to ten-thousands)

### edgeVote
`edgeVote` use `votes` egdgeCollection to store vote data and database transaction to create / update votes and update/query tabulated data store inside voteableObject to speed-up

**PROS**
 * Find out all voteableObjects a user voted before is much easier
 * Can store history data like like createdAt, updatedAt timestamps
 * Can use graph alorithm to do recommendation. For example: show me few articles that are got most of up vote from my friends

**CONS**
 * Need to store additional tabulated data fields (upVotesCount, downVotesCount, totalVotePoint) inside voteableObject
 * Need to use transaction to ensure data consistency while create/update `voteObject` and update tabulated data in voteableObject
 

### Usage example

```javascript
var user1 = db.users.save({name: 'user1'});
var user2 = db.users.save({name: 'user2'});
var user3 = db.users.save({name: 'user3'});
var article1 = db.articles.save({title: 'article1'});
var article2 = db.articles.save({title: 'article2'});

// Config voting module
var myVoting = require('voting').config({
	upVotePoint: 1,
	downVotePoint: -1,
	method: 'embed'
});

myVoting.voteUp(user3.id, article1._id);
myVoting.voteDown(user3.id, article1._id);

// For testing `embed` vs `edge` directly, use following functions,
// they use default vote up point (+1) and default vote down point (-1)
var voting = require('voting');

voting.embedVoteUp(user1._id, article1._id);
voting.embedVoteDown(user1._id, article1._id);
voting.embedVoteUp(user2._id, article1._id);
voting.embedVoteDown(user3._id, article1._id);

voting.edgeVoteUp(user1._id, article2._id);
voting.edgeVoteDown(user1._id, article2._id);
voting.edgeVoteUp(user2._id, article2._id);
voting.edgeVoteDown(user3._id, article2._id);
```

___


## Install ArangoDB 3.x on Mac OSX using homebrew

```bash
brew update
brew install arangodb
brew services start arangodb
```

## Create development and test databases

Open Web Interface at [localhost:8529](http://localhost:8529)

* `username`: *root*
* `password`:
* Then Select DB `_system` or press enter
* Click `DATABASES` > `Add Database` > enter **voteable_development** to `Name*:` > click `Create`
* Repeat above step to create **lxcd_test**
* Click `DB:_SYSTEM` at the top-right conner, click on drop down then select `voteable_development`
* Click `Select DB: voteable_development` or press enter


Or using terminal

```bash
arangosh --server.authentication false
db._createDatabase('voteable_development')
db._createDatabase('voteable_test')
```

## Link source code to Arango Foxx app
Link source code to `voteable_development` database's `voteable` Foxx app so you don't have to reploy everytime you change your code.

```bash
mkdir /usr/local/var/lib/arangodb3-apps/_db/voteable_development/voteable
ln -s ~/src/voteable-arangodb /usr/local/var/lib/arangodb3-apps/_db/voteable_development/voteable/APP
```

Setup `test` app in test database
```bash
mkdir /usr/local/var/lib/arangodb3-apps/_db/voteable_test/voteable
ln -s ~/src/voteable-arangodb /usr/local/var/lib/arangodb3-apps/_db/voteable_test/voteable/APP
```

*Restart the `arangod` to reflect changes`*
```bash
brew services restart arangodb
```

## Change to development mode and run setup script

```bash
# Set development mode
foxx-manager development /voteable --server.database voteable_development --server.authentication false
# Remove data if exists
foxx-manager teardown /voteable --server.database voteable_development --server.authentication false
# Setup database and seeding data
foxx-manager setup /voteable --server.database voteable_development --server.authentication false
```

NOTE: Some-time the development mode app doesn't reflect code change immediately. You have to restart the app manually by running command
```bash
foxx-manager development /voteable --server.database voteable_development --server.authentication false
# Or use pre-built script
./restartApps.sh
```


## The development app will reflect any code change

* Open [localhost development app](http://localhost:8529/_db/voteable_development/voteable)
* Do the code change
* Refresh the web page to reflect the change

## Logging and debug

ArangoDB's Foxx is JavaScript so just use `console.log()` to print out any information you want

Then view the log in the console
```bash
tail -1 -f /usr/local/var/log/arangodb3/arangod.log
```

Or in ArangoDB web interface at [localhost voteable_development](http://localhost:8529/_db/voteable_development/_admin/aardvark/index.html#logs)

`WARNING:` **As far as I know, there is neither debugging tool nor console for Foxx apps**

Print infor to the log file is the only way to see how your Foxx app code work internally.

## Testing, Testing, Testing ...

Run test script in the terminal whenever you want
```bash
./runTest.sh
```

**API Document**

Open `ArangoDB's swagger` at [localhost voteable_development](http://localhost:8529/_db/voteable_development/_admin/aardvark/index.html#service/%2Fvoteable)
Then click on `API` tab

# License

Copyright (c) 2016 Alex Nguyen

License: Apache 2