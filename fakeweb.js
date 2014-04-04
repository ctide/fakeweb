var fs = require('fs')
  , request = require('request')
  , url = require('url')
  , https = require('https')
  , http = require('http')
  , EventEmitter = require('events').EventEmitter
  , _allowNetConnect = true
  , _allowLocalConnect = true
  , interceptedUris = {}
  , ignoredUris = {}
  ;



function interceptable(uri, method) {

    if(typeof method === "undefined")
    {
        method = "GET";
    }

    uri = parseUrl(uri);
    if (interceptedUris[uri]) {
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

function httpModuleRequest(uri, callback) {
    var thisRequest = new EventEmitter();
    thisRequest.setEncoding = function() {};

    thisRequest.end = function() {
        var thisResponse = new EventEmitter();
        // Request module checks against the connection object event emitter
        thisResponse.connection = thisResponse;
        thisResponse.pause = thisResponse.resume = function(){};
        thisResponse.setEncoding = function() {};
        thisResponse.pipe = function(outputStream) {
            outputStream.write(interceptedUris[uri].response);
            outputStream.end();
        };
        thisResponse.statusCode = interceptedUris[uri].statusCode;
        thisResponse.headers = interceptedUris[uri].headers;
        if (interceptedUris[uri].contentType) {
            thisResponse.headers['content-type'] = interceptedUris[uri].contentType;
        }
        thisRequest.emit('response', thisResponse);

        if (callback) {
            callback(thisResponse);
        }

        thisResponse.emit('data', interceptedUris[uri].response);
        thisResponse.emit('end');
        thisResponse.emit('close');

    }
    thisRequest.write = function() {}
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
            if (interceptedUris[uri].statusCode >= 300 && interceptedUris[uri].statusCode < 400 && interceptedUris[uri].headers.Location && followRedirect) {
                var redirectTo = url.resolve(uri, interceptedUris[uri].headers.Location);
                return request.get({uri: redirectTo}, callback);
            } else {
                var resp = {statusCode : interceptedUris[uri].statusCode};
                resp.headers = interceptedUris[uri].headers;
                if (interceptedUris[uri].contentType) {
                    resp.headers['content-type'] =  interceptedUris[uri].contentType;
                }
                return callback(null, resp, interceptedUris[uri].response);
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

        var url = options.uri || options.url;
        if (interceptable(url, "POST")) {
            var resp = {statusCode : interceptedUris[url].statusCode};
            resp.headers = interceptedUris[url].headers;
            if (interceptedUris[url].contentType) {
                resp.headers['content-type'] =  interceptedUris[url].contentType;
            }
            return callback(null, resp, interceptedUris[url].response);
        } else {
            return oldRequestPost.call(request, options, callback);
        }
    }

    var oldHttpsRequest = https.request;
    https.request = function(options, callback) {
        var uri;
        if (options.port) {
            uri = "https://" + (options.hostname || options.host) + ":" + options.port + options.path;
        } else {
            uri = "https://" + options.host + options.path;
        }
        if (interceptable(uri, options.method)) {
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
        } else {
            uri = "http://" + options.host + options.path;
        }
        if (interceptable(uri, options.method)) {
            return httpModuleRequest(uri, callback);
        } else {
            return oldHttpRequest.call(http, options, callback);
        }
    }

    tearDown = function() {
        interceptedUris = {};
        allowNetConnect = true;
        allowLocalConnect = true;
        // request.get = oldRequestGet;
        // https.request = oldHttpsRequest;
        // http.request = oldHttpRequest;
    }

    registerUri = function(options) {
        options.uri = parseUrl(options.uri);
        interceptedUris[options.uri] = {};
        if (options.file || options.binaryFile) {
            if (options.binaryFile) {
                interceptedUris[options.uri].response = fs.readFileSync(options.binaryFile, 'binary');
            } else {
                interceptedUris[options.uri].response = fs.readFileSync(options.file);
            }
        } else if (options.body != undefined) {
            interceptedUris[options.uri].response = options.body;
        }
        interceptedUris[options.uri].statusCode = options.statusCode || 200;
        interceptedUris[options.uri].headers = options.headers || {};
        interceptedUris[options.uri].contentType = options.contentType;
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
