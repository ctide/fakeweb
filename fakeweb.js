const fs = require('fs');
const request = require('request');
const url = require('url');
const https = require('https');
const http = require('http');
const utils = require('./lib/utils');
const EventEmitter = require('events').EventEmitter;

function httpModuleRequest(uri, callback) {
  const thisRequest = new EventEmitter();
  const fakewebOptions = this.fakewebMatch(uri);
  const writeBuffers = [];

  thisRequest.setEncoding = () => {};
  thisRequest.setHeader = () => {};
  thisRequest.getHeader = () => {};

  thisRequest.end = () => {
    const requestBuffer = writeBuffers.length > 0 ? Buffer.concat(writeBuffers) : new Buffer(0);
    const requestBody = requestBuffer.toString('utf8');
    const thisResponse = new EventEmitter();

    // Request module checks against the connection object event emitter
    thisResponse.connection = thisResponse;
    thisResponse.pause = thisResponse.resume = () => {};
    thisResponse.setEncoding = () => {};
    thisResponse.pipe = (outputStream) => {
      outputStream.write(fakewebOptions.response(requestBody));
      outputStream.end();
      return outputStream; // support chaining
    };
    thisResponse.statusCode = utils.getStatusCode(fakewebOptions);
    thisResponse.headers = fakewebOptions.headers;

    if (fakewebOptions.contentType) {
      thisResponse.headers['content-type'] = fakewebOptions.contentType;
    }
    thisRequest.emit('response', thisResponse);

    if (callback) {
      callback(thisResponse);
    }

    thisResponse.emit('data', fakewebOptions.response(requestBody));
    thisResponse.emit('end');
    thisResponse.emit('close');
  };

  thisRequest.write = function requestWrite(buffer, encoding) {
    if (buffer) {
      if (!Buffer.isBuffer(buffer)) {
        buffer = new Buffer(buffer, encoding);
      }

      writeBuffers.push(buffer);
    }
  };

  return thisRequest;
}

function Fakeweb() {
  this.allowNetConnect = true;
  this.allowLocalConnect = true;
  this.interceptedUris = {};
  this.ignoredUris = [];
  this.regexMatches = [];

  const oldRequestGet = request.get;
  request.get = (options, callback) => {
    if (typeof options === 'string') {
      options = { uri: options };
    }

    const uri = options.uri || options.url;
    const followRedirect = options.followRedirect !== undefined ? options.followRedirect : true;
    if (this.interceptable(uri)) {
      const fakewebOptions = this.fakewebMatch(uri);
      fakewebOptions.spy.used = true;
      fakewebOptions.spy.useCount += 1;
      const statusCode = utils.getStatusCode(fakewebOptions);

      if (statusCode >= 300 && statusCode < 400 && fakewebOptions.headers.Location && followRedirect) {
        const redirectTo = url.resolve(uri, fakewebOptions.headers.Location);
        return request.get({ uri: redirectTo }, callback);
      }

      const resp = { statusCode };
      resp.headers = fakewebOptions.headers;
      if (fakewebOptions.contentType) {
        resp.headers['content-type'] = fakewebOptions.contentType;
      }
      return callback(null, resp, fakewebOptions.response());
    }
    return oldRequestGet.call(request, options, callback);
  };

  const oldRequestPost = request.post;
  request.post = (options, callback) => {
    if (typeof options === 'string') {
      options = { uri: options };
    }

    const uri = options.uri || options.url;
    if (this.interceptable(uri, 'POST')) {
      const fakewebOptions = this.fakewebMatch(uri);
      fakewebOptions.spy.used = true;
      fakewebOptions.spy.useCount += 1;

      const resp = { statusCode: utils.getStatusCode(fakewebOptions) };
      resp.headers = fakewebOptions.headers;
      if (fakewebOptions.contentType) {
        resp.headers['content-type'] = fakewebOptions.contentType;
      }
      return callback(null, resp, fakewebOptions.response(options.form));
    }
    return oldRequestPost.call(request, options, callback);
  };

  const oldHttpsRequest = https.request;
  https.request = (options, callback) => {
    let uri = options;
    if (options.port) {
      uri = `https://${(options.hostname || options.host)}:${options.port}${options.path}`;
    } else if (options.path) {
      uri = `https://${(options.hostname || options.host)}${options.path}`;
    }
    if (this.interceptable(uri, options.method)) {
      const fakewebOptions = this.fakewebMatch(uri);
      fakewebOptions.spy.used = true;
      fakewebOptions.spy.useCount += 1;
      return httpModuleRequest.call(this, uri, callback);
    }
    return oldHttpsRequest.call(https, options, callback);
  };

  const oldHttpRequest = http.request;
  http.request = (options, callback) => {
    let uri = options;
    if (options.port) {
      uri = `http://${(options.hostname || options.host)}:${options.port}${options.path}`;
    } else if (options.path) {
      uri = `http://${(options.hostname || options.host)}${options.path}`;
    }
    if (this.interceptable(uri, options.method)) {
      const fakewebOptions = this.fakewebMatch(uri);
      fakewebOptions.spy.used = true;
      fakewebOptions.spy.useCount += 1;
      return httpModuleRequest.call(this, uri, callback);
    }
    return oldHttpRequest.call(http, options, callback);
  };

  this.tearDown = function tearDown() {
    this.interceptedUris = {};
    this.regexMatches = [];
    this.allowNetConnect = true;
    this.allowLocalConnect = true;
  };

  this.registerUri = (options) => {
    if (options.uri instanceof RegExp) {
      this.regexMatches.push(options.uri);
    } else {
      options.uri = utils.parseUrl(options.uri);
    }
    this.interceptedUris[options.uri] = {};
    if (options.file || options.binaryFile) {
      if (options.binaryFile) {
        this.interceptedUris[options.uri].response = () => fs.readFileSync(options.binaryFile, 'binary');
      } else {
        this.interceptedUris[options.uri].response = () => fs.readFileSync(options.file).toString();
      }
    } else if (options.body !== undefined) {
      this.interceptedUris[options.uri].response = (typeof options.body === 'function') ? options.body : () => options.body;
    } else {
      this.interceptedUris[options.uri].response = () => undefined;
    }
    this.interceptedUris[options.uri].statusCode = options.statusCode || 200;
    this.interceptedUris[options.uri].headers = options.headers || {};
    this.interceptedUris[options.uri].contentType = options.contentType;

    const spy = { used: false, useCount: 0 };
    this.interceptedUris[options.uri].spy = spy;
    return spy;
  };

  this.ignoreUri = function ignoreUri(options) {
    this.ignoredUris[utils.parseUrl(options.uri)] = true;
  };

  return this;
}

Fakeweb.prototype.interceptable = function interceptable(uri, method) {
  if (typeof method === 'undefined') {
    method = 'GET';
  }

  uri = utils.parseUrl(uri);

  if (this.fakewebMatch(uri)) {
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

Fakeweb.prototype.fakewebMatch = function fakewebMatch(uri) {
  for (let i = 0; i < this.regexMatches.length; i += 1) {
    if (uri.match(this.regexMatches[i])) {
      return this.interceptedUris[this.regexMatches[i]];
    }
  }
  if (this.interceptedUris[uri]) {
    return this.interceptedUris[uri];
  }
  return false;
};

module.exports = new Fakeweb();
