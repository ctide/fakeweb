const fs = require('fs');
const request = require('request');
const url = require('url');
const https = require('https');
const http = require('http');
const EventEmitter = require('events').EventEmitter;
const interceptedUris = {};
const regexMatches = [];
const ignoredUris = {};

function fakewebMatch(uri) {
  for (let i = 0; i < regexMatches.length; i++) {
    if (uri.match(regexMatches[i])) {
      return interceptedUris[regexMatches[i]];
    }
  }
  if (interceptedUris[uri]) {
    return interceptedUris[uri];
  }
}


function interceptable(uri, method) {
  if (typeof method === "undefined") {
    method = "GET";
  }

  uri = parseUrl(uri);

  if (fakewebMatch(uri)) {
    return true;
  }
  if (ignoredUris[uri] || allowNetConnect) {
    return false;
  }

  if (uri) {
    const hostname = url.parse(uri).hostname;
    const requestIsLocal = (hostname == "localhost" || hostname == "127.0.0.1");
    if (allowLocalConnect === true && requestIsLocal) {
      return false;
    }
    console.error("FAKEWEB: Unhandled " + method + " request to " + uri);
    throw "FAKEWEB: Unhandled " + method + " request to " + uri;
  } else {
    console.error("FAKEWEB: Invalid request");
    throw "FAKEWEB: Invalid request";
  }
}

function getStatusCode(options) {
  let statusCode = options.statusCode;

  if (Array.isArray(statusCode)) {
    if (statusCode.length === 0) {
      statusCode = 200; // This should not happen but better safe than sorry
    } else if (statusCode.length === 1) {
      statusCode = statusCode[0];
    } else {
      statusCode = statusCode.shift();
    }
  }

  return statusCode;
}

function httpModuleRequest(uri, callback) {
  const thisRequest = new EventEmitter();
  const fakewebOptions = fakewebMatch(uri);
  const writeBuffers = [];

  thisRequest.setEncoding = function() {};
  thisRequest.setHeader = function() {};
  thisRequest.getHeader = function() {};

  thisRequest.end = function() {
    const requestBuffer = writeBuffers.length > 0 ? Buffer.concat(writeBuffers) : new Buffer(0);
    const requestBody = requestBuffer.toString('utf8');
    const thisResponse = new EventEmitter();

    // Request module checks against the connection object event emitter
    thisResponse.connection = thisResponse;
    thisResponse.pause = thisResponse.resume = function() {};
    thisResponse.setEncoding = function() {};
    thisResponse.pipe = function(outputStream) {
      outputStream.write(fakewebOptions.response(requestBody));
      outputStream.end();
      return outputStream; // support chaining
    };
    thisResponse.statusCode = getStatusCode(fakewebOptions);
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

  }

  thisRequest.write = function(buffer, encoding) {
    if (buffer) {
      if (!Buffer.isBuffer(buffer)) {
        buffer = new Buffer(buffer, encoding);
      }

      writeBuffers.push(buffer);
    }
  }

  return thisRequest;
}

function Fakeweb() {
  this.allowNetConnect = true;
  this.allowLocalConnect = true;

  const oldRequestGet = request.get;
  request.get = function(options, callback) {
    if (typeof options === "string") {
      options = {uri: options};
    }

    const uri = options.uri || options.url;
    const followRedirect = options.followRedirect !== undefined ? options.followRedirect : true
    if (interceptable(uri)) {
      const fakewebOptions = fakewebMatch(uri);
      fakewebOptions.spy.used = true;
      fakewebOptions.spy.useCount++;
      const statusCode = getStatusCode(fakewebOptions);

      if (statusCode >= 300 && statusCode < 400 && fakewebOptions.headers.Location && followRedirect) {
        const redirectTo = url.resolve(uri, fakewebOptions.headers.Location);
        return request.get({uri: redirectTo}, callback);
      } else {
        const resp = {statusCode: statusCode};
        resp.headers = fakewebOptions.headers;
        if (fakewebOptions.contentType) {
          resp.headers['content-type'] =  fakewebOptions.contentType;
        }
        return callback(null, resp, fakewebOptions.response());
      }
    } else {
      return oldRequestGet.call(request, options, callback);
    }
  }

  const oldRequestPost = request.post;
  request.post = function(options, callback) {
    if (typeof options === "string"){
      options = {uri: options};
    }

    const uri = options.uri || options.url;
    if (interceptable(uri, "POST")) {
      const fakewebOptions = fakewebMatch(uri);
      fakewebOptions.spy.used = true;
      fakewebOptions.spy.useCount++;

      const resp = {statusCode : getStatusCode(fakewebOptions)};
      resp.headers = fakewebOptions.headers;
      if (fakewebOptions.contentType) {
        resp.headers['content-type'] =  fakewebOptions.contentType;
      }
      return callback(null, resp, fakewebOptions.response(options.form));
    } else {
      return oldRequestPost.call(request, options, callback);
    }
  }

  const oldHttpsRequest = https.request;
  https.request = function(options, callback) {
    let uri = options;
    if (options.port) {
      uri = "https://" + (options.hostname || options.host) + ":" + options.port + options.path;
    } else if (options.path) {
      uri = "https://" + (options.hostname || options.host) + options.path;
    }
    if (interceptable(uri, options.method)) {
      const fakewebOptions = fakewebMatch(uri);
      fakewebOptions.spy.used = true;
      fakewebOptions.spy.useCount++;
      return httpModuleRequest(uri, callback);
    } else {
      return oldHttpsRequest.call(https, options, callback);
    }
  }

  const oldHttpRequest = http.request;
  http.request = function(options, callback) {
    let uri = options;
    if (options.port) {
      uri = "http://" + (options.hostname || options.host) + ":" + options.port + options.path;
    } else if (options.path) {
      uri = "http://" + (options.hostname || options.host) + options.path;
    }
    if (interceptable(uri, options.method)) {
      const fakewebOptions = fakewebMatch(uri);
      fakewebOptions.spy.used = true;
      fakewebOptions.spy.useCount++;
      return httpModuleRequest(uri, callback);
    } else {
      return oldHttpRequest.call(http, options, callback);
    }
  }

  tearDown = function() {
    interceptedUris = {};
    regexMatches = [];
    allowNetConnect = true;
    allowLocalConnect = true;
  }

  registerUri = function(options) {
    if (options.uri instanceof RegExp) {
      regexMatches.push(options.uri);
    } else {
      options.uri = parseUrl(options.uri);
    }
    interceptedUris[options.uri] = {};
    if (options.file || options.binaryFile) {
      if (options.binaryFile) {
        interceptedUris[options.uri].response = function() {
          return fs.readFileSync(options.binaryFile, 'binary');
        }
      } else {
        interceptedUris[options.uri].response = function() {
          return fs.readFileSync(options.file).toString();
        };
      }
    } else if (options.body != undefined) {
      interceptedUris[options.uri].response = (typeof options.body === "function") ? options.body : function () { return options.body; };
    } else {
      interceptedUris[options.uri].response = function() { return undefined; };
    }
    interceptedUris[options.uri].statusCode = options.statusCode || 200;
    interceptedUris[options.uri].headers = options.headers || {};
    interceptedUris[options.uri].contentType = options.contentType;

    const spy = { used: false, useCount: 0 };
    interceptedUris[options.uri].spy = spy;
    return spy;
  }

  ignoreUri = function(options) {
    ignoredUris[parseUrl(options.uri)] = true;
  }

  return this;
};

module.exports = Fakeweb();


function parseUrl(uri) {
  const tempUrl = url.parse(uri);
  if (!tempUrl.port) {
    if (tempUrl.protocol === 'http:') {
      tempUrl.port = 80;
    } else if (tempUrl.protocol === 'https:') {
      tempUrl.port = 443;
    }
  }
  return url.format(tempUrl);
}
