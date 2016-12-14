const fs = require('fs');
const url = require('url');
const request = require('request');
const https = require('https');
const http = require('http');
const utils = require('./lib/utils');
const overrides = require('./lib/overrides');

class Fakeweb {
  constructor() {
    this.allowNetConnect = true;
    this.allowLocalConnect = true;
    this.interceptedUris = {};
    this.ignoredUris = [];
    this.regexMatches = [];
    this.setup();
  }

  setup() {
    request.get = overrides.requestGet.bind(this);
    request.post = overrides.requestPost.bind(this);
    https.request = overrides.httpsRequest.bind(this);
    http.request = overrides.httpRequest.bind(this);
  }
}

Fakeweb.prototype.tearDown = function tearDown() {
  this.interceptedUris = {};
  this.regexMatches = [];
  this.allowNetConnect = true;
  this.allowLocalConnect = true;
};

Fakeweb.prototype.registerUri = function registerUri(options) {
  if (options.uri instanceof RegExp) {
    if (this.regexMatches.indexOf(options.uri) === -1) {
      this.regexMatches.push(options.uri);
    }
  } else {
    options.uri = utils.parseUrl(options.uri);
  }
  const interception = {};
  if (options.file || options.binaryFile) {
    if (options.binaryFile) {
      interception.response = () => fs.readFileSync(options.binaryFile, 'binary');
    } else {
      interception.response = () => fs.readFileSync(options.file).toString();
    }
  } else if (options.body !== undefined) {
    interception.response = (typeof options.body === 'function') ? options.body : () => options.body;
  } else {
    interception.response = () => undefined;
  }
  interception.statusCode = options.statusCode || 200;
  interception.headers = options.headers || {};
  interception.contentType = options.contentType;
  interception.exception = options.exception;

  const spy = { used: false, useCount: 0 };
  interception.spy = spy;
  if (!this.interceptedUris[options.uri]) {
    this.interceptedUris[options.uri] = {};
  }
  this.interceptedUris[options.uri][options.method || 'ANY'] = interception;
  return spy;
};

Fakeweb.prototype.ignoreUri = function ignoreUri(options) {
  this.ignoredUris[utils.parseUrl(options.uri)] = true;
};

Fakeweb.prototype.interceptable = function interceptable(uri, method) {
  if (typeof method === 'undefined') {
    method = 'GET';
  }

  uri = utils.parseUrl(uri);

  if (this.fakewebMatch(uri, method)) {
    return true;
  }
  if (this.ignoredUris[uri] || this.allowNetConnect) {
    return false;
  }

  if (uri) {
    const hostname = url.parse(uri).hostname;
    const requestIsLocal = (hostname === 'localhost' || hostname === '127.0.0.1');
    if (this.allowLocalConnect === true && requestIsLocal) {
      return false;
    }
    const errorMessage = `FAKEWEB: Unhandled ${method} request to ${uri}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  } else {
    console.error('FAKEWEB: Invalid request');
    throw new Error('FAKEWEB: Invalid request');
  }
};

Fakeweb.prototype.fakewebMatch = function fakewebMatch(uri, method) {
  method = (method || '').toUpperCase();
  uri = utils.parseUrl(uri);
  for (let i = 0; i < this.regexMatches.length; i += 1) {
    if (uri.match(this.regexMatches[i])) {
      if (this.interceptedUris[this.regexMatches[i]][method]) {
        return this.interceptedUris[this.regexMatches[i]][method];
      }
      return this.interceptedUris[this.regexMatches[i]].ANY;
    }
  }
  if (this.interceptedUris[uri]) {
    if (this.interceptedUris[uri][method]) {
      return this.interceptedUris[uri][method];
    }
    return this.interceptedUris[uri].ANY;
  }
  return false;
};

module.exports = new Fakeweb();
