'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const Article = require('../models/article');

const articles = require("@arangodb").db.articles;
const keySchema = joi.string().required()
.description('The key of the article');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const router = createRouter();
module.exports = router;


router.get(function (req, res) {
  res.send(articles.all());
}, 'list')
.response([Article], 'A list of articles.')
.summary('List all articles')
.description(dd`
  Retrieves a list of all articles.
`);


router.post(function (req, res) {
  const article = req.body;
  let meta;
  try {
    meta = articles.save(article);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(article, meta);
  res.status(201);
  res.set('location', req.makeAbsolute(
    req.reverse('detail', {key: article._key})
  ));
  res.send(article);
}, 'create')
.body(Article, 'The article to create.')
.response(201, Article, 'The created article.')
.error(HTTP_CONFLICT, 'The article already exists.')
.summary('Create a new article')
.description(dd`
  Creates a new article from the request body and
  returns the saved document.
`);


router.get(':key', function (req, res) {
  const key = req.pathParams.key;
  let article
  try {
    article = articles.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  res.send(article);
}, 'detail')
.pathParam('key', keySchema)
.response(Article, 'The article.')
.summary('Fetch a article')
.description(dd`
  Retrieves a article by its key.
`);


router.put(':key', function (req, res) {
  const key = req.pathParams.key;
  const article = req.body;
  let meta;
  try {
    meta = articles.replace(key, article);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(article, meta);
  res.send(article);
}, 'replace')
.pathParam('key', keySchema)
.body(Article, 'The data to replace the article with.')
.response(Article, 'The new article.')
.summary('Replace a article')
.description(dd`
  Replaces an existing article with the request body and
  returns the new document.
`);


router.patch(':key', function (req, res) {
  const key = req.pathParams.key;
  const patchData = req.body;
  let article;
  try {
    articles.update(key, patchData);
    article = articles.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send(article);
}, 'update')
.pathParam('key', keySchema)
.body(joi.object().description('The data to update the article with.'))
.response(Article, 'The updated article.')
.summary('Update a article')
.description(dd`
  Patches a article with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
  const key = req.pathParams.key;
  try {
    articles.remove(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
}, 'delete')
.pathParam('key', keySchema)
.response(null)
.summary('Remove a article')
.description(dd`
  Deletes a article from the database.
`);
