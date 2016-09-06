var fs = require('fs')
  , request = require('request')
  , url = require('url')
  , https = require('https')
  , http = require('http')
  , EventEmitter = require('events').EventEmitter
  , _allowNetConnect = true
  , _allowLocalConnect = true
  , interceptedUris = {}
  , regexMatches = []
  , ignoredUris = {}
  ;


function fakewebMatch(uri) {
    for (var i = 0; i < regexMatches.length; i++) {
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
    if (ignoredUris[uri]) {
        return false;
    }
    if (allowNetConnect === false) {
        if (uri) {
            var hostname = url.parse(uri).hostname
              , requestIsLocal = (hostname == "localhost" || hostname == "127.0.0.1")
              ;
            if (allowLocalConnect === true && requestIsLocal) {
                return false;
            }
            console.error("FAKEWEB: Unhandled" + method + "request to " + uri);
            throw "FAKEWEB: Unhandled " + method + " request to " + uri;
        } else {
            console.error("FAKEWEB: Invalid request");
            throw "FAKEWEB: Invalid request";
        }
    } else {
        return false;
    }
}

function getStatusCode(options) {
    var statusCode = options.statusCode;

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

function updateSpy(uri, options) {
    options.spy.used = true;
    options.spy.useCount++;
    if (typeof options.spy.hook === "function") {
        options.spy.hook(uri);
    }
}

function httpModuleRequest(uri, callback) {
    var thisRequest = new EventEmitter();
    var fakewebOptions = fakewebMatch(uri);
    var writeBuffers = [];
    thisRequest.setEncoding = function() {};
    thisRequest.setHeader = function() {};
    thisRequest.getHeader = function() {};

    thisRequest.end = function() {
        var requestBuffer = writeBuffers.length > 0 ? Buffer.concat(writeBuffers) : new Buffer(0);
        var requestBody = requestBuffer.toString('utf8');
        var thisResponse = new EventEmitter();
        // Request module checks against the connection object event emitter
        thisResponse.connection = thisResponse;
        thisResponse.pause = thisResponse.resume = function(){};
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
      if(buffer) {
        if(!Buffer.isBuffer(buffer)) {
          buffer = new Buffer(buffer, encoding);
        }
        writeBuffers.push(buffer);
      }
    }
    return thisRequest;
}

function Fakeweb() {
    this.allowNetConnect = _allowNetConnect;
    this.allowLocalConnect = _allowLocalConnect;

    var oldRequestGet = request.get;
    request.get = function(options, callback) {
        if(typeof options === "string"){
            options = {uri: options};
        }

        var uri = options.uri || options.url;
        var followRedirect = options.followRedirect !== undefined ? options.followRedirect : true
        if (interceptable(uri)) {
            var fakewebOptions = fakewebMatch(uri);
            updateSpy(uri, fakewebOptions);
            var statusCode = getStatusCode(fakewebOptions);

            if (statusCode >= 300 && statusCode < 400 && fakewebOptions.headers.Location && followRedirect) {
                var redirectTo = url.resolve(uri, fakewebOptions.headers.Location);
                return request.get({uri: redirectTo}, callback);
            } else {
                var resp = {statusCode : statusCode};
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

    var oldRequestPost = request.post;
    request.post = function(options, callback) {
        if(typeof options === "string"){
            options = {uri: options};
        }

        var uri = options.uri || options.url;
        if (interceptable(uri, "POST")) {
            var fakewebOptions = fakewebMatch(uri);
            updateSpy(uri, fakewebOptions);

            var resp = {statusCode : getStatusCode(fakewebOptions)};
            resp.headers = fakewebOptions.headers;
            if (fakewebOptions.contentType) {
                resp.headers['content-type'] =  fakewebOptions.contentType;
            }
            return callback(null, resp, fakewebOptions.response(options.form));
        } else {
            return oldRequestPost.call(request, options, callback);
        }
    }

    var oldHttpsRequest = https.request;
    https.request = function(options, callback) {
        var uri;
        if (options.port) {
            uri = "https://" + (options.hostname || options.host) + ":" + options.port + options.path;
        } else if (options.path) {
            uri = "https://" + (options.hostname || options.host) + options.path;
        } else {
            uri = options;
        }
        if (interceptable(uri, options.method)) {
            var fakewebOptions = fakewebMatch(uri);
            updateSpy(uri, fakewebOptions);
            return httpModuleRequest(uri, callback);
        } else {
            return oldHttpsRequest.call(https, options, callback);
        }
    }

    var oldHttpRequest = http.request;
    http.request = function(options, callback) {
        var uri;
        if (options.port) {
            uri = "http://" + (options.hostname || options.host) + ":" + options.port + options.path;
        } else if (options.path) {
            uri = "http://" + (options.hostname || options.host) + options.path;
        } else {
            uri = options;
        }
        if (interceptable(uri, options.method)) {
            var fakewebOptions = fakewebMatch(uri);
            updateSpy(uri, fakewebOptions);
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
                };
            } else {
                interceptedUris[options.uri].response = function() {
                  return fs.readFileSync(options.file).toString();
                };
            }
        } else if (options.body != undefined) {
            var responseHandler = (typeof options.body === "function") ? options.body :
              function (){ return options.body; };
            interceptedUris[options.uri].response = responseHandler;
        } else {
            interceptedUris[options.uri].response = function() { return undefined; };
        }
        interceptedUris[options.uri].statusCode = options.statusCode || 200;
        interceptedUris[options.uri].headers = options.headers || {};
        interceptedUris[options.uri].contentType = options.contentType;
        interceptedUris[options.uri].uri = options.uri;

        var spy = { used: false, useCount: 0, hook: null };
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
    var tempUrl = url.parse(uri);
    if (!tempUrl.port) {
        if (tempUrl.protocol === 'http:') {
            tempUrl.port = 80;
        } else if (tempUrl.protocol === 'https:') {
            tempUrl.port = 443;
        }
    }
    return url.format(tempUrl);
}
