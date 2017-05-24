const EventEmitter = require('events').EventEmitter;
const request = require('request');
const https = require('https');
const http = require('http');
const utils = require('./utils');
const url = require('url');

const oldRequestGet = request.get;
const oldRequestPost = request.post;
const oldHttpsRequest = https.request;
const oldHttpRequest = http.request;

function createException() {
  const error = new Error(`connect ECONNREFUSED`);
  error.code = 'ECONNREFUSED';
  error.errno = 'ECONNREFUSED';
  error.syscall = 'connect';
  return error;
}

function httpModuleRequest(uri, callback, fakewebOptions) {
  const thisRequest = new EventEmitter();
  const writeBuffers = [];

  thisRequest.setEncoding = () => {};
  thisRequest.setHeader = () => {};
  thisRequest.getHeader = () => {};
  thisRequest.setNoDelay = () => {};
  thisRequest.setSocketKeepAlive = () => {};

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

    if (fakewebOptions.exception) {
      const error = createException();
      thisResponse.emit('error', error);
      thisResponse.emit('end');
      thisResponse.emit('close');
      return;
    }

    fakewebOptions.spy.body = requestBody;
    thisResponse.emit('data', fakewebOptions.response(requestBody));
    thisResponse.emit('end');
    thisResponse.emit('close');
  };

  thisRequest.write = function requestWrite(buffer, encoding, cb) {
    if (buffer) {
      if (!Buffer.isBuffer(buffer)) {
        buffer = new Buffer(buffer, encoding);
      }

      writeBuffers.push(buffer);
    }
    if (cb) {
      cb();
    }
  };

  return thisRequest;
}

function requestGet(options, callback) {
  if (typeof options === 'string') {
    options = { uri: options };
  }

  const uri = options.uri || options.url;
  const followRedirect = options.followRedirect !== undefined ? options.followRedirect : true;
  if (this.interceptable(uri)) {
    const fakewebOptions = this.fakewebMatch(uri, 'GET');
    fakewebOptions.spy.used = true;
    fakewebOptions.spy.useCount += 1;
    if (fakewebOptions.exception) {
      throw createException(fakewebOptions);
    }
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
    const body = options.json ? JSON.parse(fakewebOptions.response()) : fakewebOptions.response();
    return callback(null, resp, body);
  }
  return oldRequestGet.call(request, options, callback);
}

function requestPost(options, callback) {
  if (typeof options === 'string') {
    options = { uri: options };
  }

  const uri = options.uri || options.url;
  if (this.interceptable(uri, 'POST')) {
    const fakewebOptions = this.fakewebMatch(uri, 'POST');
    fakewebOptions.spy.used = true;
    fakewebOptions.spy.useCount += 1;
    fakewebOptions.spy.body = options.body;
    fakewebOptions.spy.form = options.form;
    if (fakewebOptions.exception) {
      throw createException(fakewebOptions);
    }

    const resp = { statusCode: utils.getStatusCode(fakewebOptions) };
    resp.headers = fakewebOptions.headers;
    if (fakewebOptions.contentType) {
      resp.headers['content-type'] = fakewebOptions.contentType;
    }
    const body = options.json ? JSON.parse(fakewebOptions.response(options.form)) : fakewebOptions.response(options.form);
    return callback(null, resp, body);
  }
  return oldRequestPost.call(request, options, callback);
}

function httpsRequest(options, callback) {
  let uri = options;
  if (options.port) {
    uri = `https://${(options.hostname || options.host)}:${options.port}${options.path}`;
  } else if (options.path) {
    uri = `https://${(options.hostname || options.host)}${options.path}`;
  }
  if (this.interceptable(uri, options.method)) {
    const fakewebOptions = this.fakewebMatch(uri, options.method);
    fakewebOptions.spy.used = true;
    fakewebOptions.spy.useCount += 1;
    return httpModuleRequest.call(this, uri, callback, fakewebOptions);
  }
  return oldHttpsRequest.call(https, options, callback);
}

function httpRequest(options, callback) {
  let uri = options;
  if (options.port) {
    uri = `http://${(options.hostname || options.host)}:${options.port}${options.path}`;
  } else if (options.path) {
    uri = `http://${(options.hostname || options.host)}${options.path}`;
  }
  if (this.interceptable(uri, options.method)) {
    const fakewebOptions = this.fakewebMatch(uri, options.method);
    fakewebOptions.spy.used = true;
    fakewebOptions.spy.useCount += 1;
    return httpModuleRequest.call(this, uri, callback, fakewebOptions);
  }
  return oldHttpRequest.call(http, options, callback);
}

module.exports.httpRequest = httpRequest;
module.exports.httpsRequest = httpsRequest;
module.exports.requestGet = requestGet;
module.exports.requestPost = requestPost;
