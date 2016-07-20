'use strict';
const assert = require('assert');
const _ = require('lodash');
const db = require("@arangodb").db;
const aql = require("@arangodb/aql");

const UP = 'up';
const DOWN = 'down';
const VOTE_TYPES = [ UP, DOWN ];
const VOTE_POINTS = {
  up: 1, 
  down: -1
};

function isValidVoteType(type) {
  if (type === UP || type === DOWN) {
    return true;
  }
}

function voterIdsFieldName(type) {
  if (isValidVoteType(type)) {
    return type + 'VoterIds';
  }
}

function remainVoterIdsFieldName(type) {
  switch (type) {
    case UP: type = DOWN; break;
    case DOWN: type = UP; break;
  }
  return voterIdsFieldName(type);
}

function getCollectionNameFromId(voteableId) {
  // Use database function AQL_PARSE_IDENTIFIER directly
  return aql.AQL_PARSE_IDENTIFIER(voteableId).collection;

  // voteableId is a string with "collectionName/objectId" format. 'articles/1234' for example
  // We can extract the collectionName to use it in AQL query statement
  // return voteableId.split('/')[0];
}

// Add upVoterIds and downVoterIds array in to the voteable objects
// Return tabulated data or NULL (if voterId already voted)
function embedVote(voterId, voteableId, type, vote_points) {
  assert(isValidVoteType(type), "vote type must be in " + VOTE_TYPES);

  var voterIdsField = voterIdsFieldName(type);
  var remainVoterIdsField = remainVoterIdsFieldName(type);
  var voteableCollection = getCollectionNameFromId(voteableId);

  var queryStatement = `
    LET voteableObj = DOCUMENT("${voteableId}")

    UPDATE voteableObj WITH {
      ${voterIdsField}: PUSH( voteableObj.${voterIdsField}, "${voterId}", true ),
      ${remainVoterIdsField}: REMOVE_VALUE( voteableObj.${remainVoterIdsField}, "${voterId}", 1 )
    } IN ${voteableCollection}

      LET upVotesCount = LENGTH( NEW.upVoterIds )
      LET downVotesCount = LENGTH( NEW.downVoterIds )

      RETURN {
        id: NEW._id,
        upVotesCount: upVotesCount,
        downVotesCount: downVotesCount,
        totalVotePoint: ${vote_points[UP]}*upVotesCount + ${vote_points[DOWN]}*downVotesCount
      }
  `
  // console.log(queryStatement.replace(/\s+/g, " ")); /* DEBUG */
  return db._query(queryStatement).toArray()[0];
}


// Using additional votes edgeCollection
function edgeVote(voterId, voteableId, type, vote_points) {
  assert(isValidVoteType(type), "vote type must be in " + VOTE_TYPES);

  var voteableCollection = getCollectionNameFromId(voteableId);
  var tabulatedData;

  // While excecuting below transaction, both 'votes' and voteableCollection are locked to
  // ensure data isolation and consistency:
  // * No-one can modify those collections while transaction is being executed
  // * All database changes will be success or failure together
  db._executeTransaction({
    collections: {
      write: [ 'votes', voteableCollection ]
    },

    // If you need 100% durability, change waitForSync to true. The db will wait until transaction data
    // is written to disk before return the result
    waitForSync: false,

    action: function () {

      var db = require("internal").db;

      // UPSERT .. mean: If there is no vote _from voterId _to voteableId, create it with INSERT ...
      // Else update vote data with UPDATE ...
      var result = db._query(`
        UPSERT { _from: "${voterId}", _to: "${voteableId}" }
        INSERT { _from: "${voterId}", _to: "${voteableId}", type: "${type}", count: 1, createdAt: DATE_NOW() }
        UPDATE { type: "${type}", count: OLD.count + 1,  updatedAt: DATE_NOW() } IN votes
        RETURN { isNewVote: IS_NULL(OLD), isSameVote: OLD && (OLD.type == NEW.type) }
      `).toArray()[0];
      // console.log(result); /* DEBUG */

      if (result.isSameVote) {

        tabulatedData = db._query(`
          LET voteableObj = DOCUMENT("${voteableId}")
            RETURN {
              id: voteableObj._id,
              upVotesCount: voteableObj.upVotesCount,
              downVotesCount: voteableObj.downVotesCount,
              totalVotePoint: voteableObj.totalVotePoint
            }
        `).toArray()[0];

      } else { // new-vote or re-vote

        var upVotesCountDelta = 0;
        var downVotesCountDelta = 0;

        if (result.isNewVote) {
          if (type === 'up') {
            upVotesCountDelta = 1;
          } else { // down vote
            downVotesCountDelta = 1;
          }
        } else { // re-vote
          if (type === 'up') {
            upVotesCountDelta = 1;
            downVotesCountDelta = -1;
          } else { // down vote
            upVotesCountDelta = -1;
            downVotesCountDelta = 1;
          }
        }

        // console.log(upVotesCountDelta); /* DEBUG */
        // console.log(downVotesCountDelta); /* DEBUG */

        tabulatedData = db._query(`
          LET voteableObj = DOCUMENT("${voteableId}")

            LET upVotesCount = voteableObj.upVotesCount + ${upVotesCountDelta}
            LET downVotesCount = voteableObj.downVotesCount + ${downVotesCountDelta}

            UPDATE voteableObj WITH {
                upVotesCount: upVotesCount,
                downVotesCount: downVotesCount,
                totalVotePoint: ${vote_points[UP]}*upVotesCount + ${vote_points[DOWN]}*downVotesCount
            } IN ${voteableCollection}

            RETURN {
              id: NEW._id,
              upVotesCount: NEW.upVotesCount,
              downVotesCount: NEW.downVotesCount,
              totalVotePoint: NEW.totalVotePoint
            }
        `).toArray()[0];
      }
    } // action
  }); // _executeTransaction
  return tabulatedData;
}


module.exports = {
  // Usage: config({ upVotePoint: 1, downVotePoint: -1, method: 'edge' })
  config(opts = {}) {
    assert(
      !isNaN(opts.upVotePoint) && !isNaN(opts.downVotePoint), 
      "upVotePoint and downVotePoint options must be a number"
    )

    var vote_points = {};
    vote_points[UP] = opts.upVotePoint;
    vote_points[DOWN] = opts.downVotePoint;

    switch (opts.method) {
      case 'embed':
        return {
          voteUp(voterId, voteableId) {
            return embedVote(voterId, voteableId, UP, vote_points);
          },
          voteDown(voterId, voteableId) {
            return embedVote(voterId, voteableId, DOWN, vote_points);
          }
        };
      case 'edge':
        return {
          voteUp(voterId, voteableId) {
            return edgeVote(voterId, voteableId, UP, vote_points);
          },
          voteDown(voterId, voteableId) {
            return edgeVote(voterId, voteableId, DOWN, vote_points);
          }
        };
      default:
        throw "method option must be 'embed' or 'edge'";
    }
  },

  // Functions for testing purpose
  embedVoteUp(voterId, voteableId) {
    return embedVote(voterId, voteableId, UP, VOTE_POINTS);
  },
  embedVoteDown(voterId, voteableId) {
    return embedVote(voterId, voteableId, DOWN, VOTE_POINTS);
  },

  edgeVoteUp(voterId, voteableId) {
    return edgeVote(voterId, voteableId, UP, VOTE_POINTS);
  },
  edgeVoteDown(voterId, voteableId) {
    return edgeVote(voterId, voteableId, DOWN, VOTE_POINTS);
  }
};

// Default will use edge voting methods
module.exports.voteUp = module.exports.edgeVoteUp;
module.exports.voteDown = module.exports.edgeVoteDown;
