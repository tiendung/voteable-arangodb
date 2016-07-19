'use strict';
const _ = require('lodash');
const db = require("@arangodb").db;

const VOTE_POINTS = {
  up: +1,
  down: -1
};
const VOTE_TYPES = _.keys(VOTE_POINTS);

const REMAIN_VOTE_TYPES = {
  up: 'down',
  down: 'up'
}

function isValidVoteType(type) {
  if (VOTE_POINTS[type] !== null) {
    return true;
  }
}

function voterIdsFieldName(type) {
  if (isValidVoteType(type)) {
    return type + 'VoterIds';
  }
}

function remainVoterIdsFieldName(type) {
  if (isValidVoteType(type)) {
    return REMAIN_VOTE_TYPES[type] + 'VoterIds';
  }  
}

function getCollectionNameFromId(voteableId) {
  // voteableId is a string with "collectionName/objectId" format. 'articles/1234' for example
  // We extract the collectionName to use it in AQL query statement
  return voteableId.split('/')[0];  
}

// Add upVoterIds and downVoterIds array in to the voteable objects
// Return tabulated data or NULL (if voterId already voted)
function embedVote(voterId, voteableId, type) {
  if (!isValidVoteType(type)) {
    throw "vote type must be in " + VOTE_TYPES;
  }

  var voterIdsField = voterIdsFieldName(type);
  var remainVoterIdsField = remainVoterIdsFieldName(type);
  var voteableCollection = getCollectionNameFromId(voteableId);

  // FOR voteableObj IN ${voteableCollection}
  //   FILTER voteableObj._id == "${voteableId}"
  //     LET neverVotedUp = ( voteableObj.upVoterIds == null OR "${voterId}" NOT IN voteableObj.upVoterIds )
  //     LET neverVotedDown = ( voteableObj.downVoterIds == null OR "${voterId}" NOT IN voteableObj.downVoterIds )
  //     LET isNewVote = neverVotedDown && neverVotedUp

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
        upVotes: upVotesCount,
        downVotes: downVotesCount,
        point: ${VOTE_POINTS.up}*upVotesCount + ${VOTE_POINTS.down}*downVotesCount
      }
  `
  // console.log(queryStatement); /* DEBUG */
  return db._query(queryStatement).toArray()[0];
}


// Using additional votes edgeCollection
function edgeVote(voterId, voteableId, type) {
  if (!isValidVoteType(type)) {
    throw "vote type must be in " + VOTE_TYPES;
  }

  var voteableCollection = getCollectionNameFromId(voteableId);
  var tabulatedData;

  db._executeTransaction({
    collections: {
      write: [ 'votes', voteableCollection ]
    },
    waitForSync: true,
    action: function () {
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
              upVotes: voteableObj.upVotesCount,
              downVotes: voteableObj.downVotesCount,
              point: voteableObj.totalVotePoint
            }
        `).toArray()[0];

      } else { // new-vote or re-vote

        var upVotesCountDelta = 0;
        var downVotesCountDelta = 0;

        if (result.isNewVote) {
          if (type === 'up') {
            upVotesCountDelta = 1;
          } else {
            downVotesCountDelta = 1;
          }
        } else { // re-vote
          if (type === 'up') {
            upVotesCountDelta = 1;
            downVotesCountDelta = -1;
          } else {
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
                totalVotePoint: ${VOTE_POINTS.up}*upVotesCount + ${VOTE_POINTS.down}*downVotesCount
            } IN ${voteableCollection}

            RETURN {
              id: NEW._id,
              upVotes: NEW.upVotesCount,
              downVotes: NEW.downVotesCount,
              point: NEW.totalVotePoint
            }
        `).toArray()[0];
      }
    } // action
  }); // _executeTransaction
  return tabulatedData;
}


module.exports = {
  VOTE_POINTS: VOTE_POINTS,
  VOTE_TYPES: VOTE_TYPES,

  embedVoteUp(voterId, voteableId) {
    return embedVote(voterId, voteableId, 'up');
  },
  embedVoteDown(voterId, voteableId) {
    return embedVote(voterId, voteableId, 'down');
  },

  edgeVoteUp(voterId, voteableId) {
    return edgeVote(voterId, voteableId, 'up');
  },
  edgeVoteDown(voterId, voteableId) {
    return edgeVote(voterId, voteableId, 'down');
  }
};
