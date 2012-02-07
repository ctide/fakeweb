var vows = require('vows')
  , request = require('request')
  , http = require('http')
  , https = require('https')
  , fakeweb = require('../fakeweb.js')
  , assert = require('assert')
  , fs = require('fs')
  , path = require('path')
  , fixture
  , events = require('events')
  ;

console.error = function() {};
fakeweb.allowNetConnect = false;
fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'README.md')).toString();

vows.describe('Fakeweb').addBatch({
    "will read a fixture from disk and return that" : {
        "when queried with request": {
            topic: function() {
                fakeweb.registerUri({uri: 'http://www.readme.com/', file: path.join(__dirname, 'fixtures', 'README.md')});
                request.get({uri: 'http://www.readme.com/'}, this.callback); },
            "successfully" : function(err, resp, body) {
                assert.equal(body.toString(), fixture);
            }
        },
        "and when queried using ": {
            topic: function() {
                var self = this;
                var data = '';
                fakeweb.registerUri({uri: 'http://www.readme.com:80/', file: path.join(__dirname, 'fixtures', 'README.md')});
                var req = http.request({host: 'www.readme.com', port: '80', path: '/', method: 'GET'}, function(res) {
                    res.on('data', function(chunk) {
                        data += chunk;
                    });
                    res.on('close', function() {
                        self.callback(undefined, data);
                    });
                });
                req.end();
            },
            "http" : function(err, resp) {
                assert.isNull(err);
                assert.equal(resp.toString(), fixture);
            }
        }
    },
    'will throw an exception with allowNetConnect off and you make ' : {
        'a GET request via request module' : function() {
            assert.throws(function() { request.get({uri: 'http://www.test.com/'}); });
        },
        'a POST request via request module' : function() {
            assert.throws(function() { request.post({uri: 'http://www.test.com/'}); });
        },
        'a request using the HTTP module' : function() {
            assert.throws(function() { http.request({host: 'www.test.com', port: 80, path: '/', method: 'GET'}); });
        },
        'a request using the HTTPS module' : function() {
            assert.throws(function() { https.request({host: 'www.test.com', port: 80, path: '/', method: 'GET'}); });
        }
    },
    'will allow connections to local resources if allowLocalConnect ' : {
        'is set to true' : function() {
            assert.doesNotThrow(function() { request.get({uri: 'http://localhost:4324'}, function() {} ); });
        }
    },
    'will allow connections to URLs specifically defined as ignored when allowNetConnect is off' : function() {
        fakeweb.ignoreUri({uri: 'http://www.google.com:80/'});
        assert.doesNotThrow(function() { request.get({uri: 'http://www.google.com:80/'}, function() {} ); });
    },
    'will set content type ' : {
        'with request' : {
            topic: function() {
                fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', contentType: 'testing'});
                request.get({uri: 'http://www.contenttype.com:80/'}, this.callback); },
            "correctly on the response" : function(err, resp, body) {
                assert.equal(resp.headers['content-type'], 'testing');
            }
        },
        'with http' : {
            topic: function() {
                fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', contentType: 'testing'});
                var self = this;
                var data = '';
                var req = http.request({host: 'www.contenttype.com', port: '80', path: '/', method: 'GET'}, function(res) {
                    res.on('data', function(chunk) {
                        data += chunk;
                    });
                    res.on('close', function() {
                        self.callback(undefined, res, data);
                    });
                });
                req.end();
            },
            "correctly on the response" : function(err, resp, data) {
                assert.equal(resp.headers['content-type'], 'testing');
                assert.equal(data, 'body');
            }
        }
    },
    'can set arbitrary headers ' : {
        'with request' : {
            topic: function() {
                fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', headers: {location: 'testing'}});
                request.get({uri: 'http://www.contenttype.com:80/'}, this.callback); },
            "correctly on the response" : function(err, resp, body) {
                assert.equal(resp.headers['location'], 'testing');
            }
        },
        'with http' : {
            topic: function() {
                fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', headers: {location: 'testing'}});
                var self = this;
                var data = '';
                var req = http.request({host: 'www.contenttype.com', port: '80', path: '/', method: 'GET'}, function(res) {
                    res.on('data', function(chunk) {
                        data += chunk;
                    });
                    res.on('close', function() {
                        self.callback(undefined, res, data);
                    });
                });
                req.end();
            },
            "correctly on the response" : function(err, resp, data) {
                assert.equal(resp.headers['location'], 'testing');
                assert.equal(data, 'body');
            }
        }
    },
    "won't truncate " : {
        topic: function() {
            fakeweb.registerUri({uri: 'http://www.testingimages.com/grimace.jpg', binaryFile: path.join(__dirname, 'fixtures', 'grimace.jpg'), contentType: 'image/jpeg'});
            request.get({uri: 'http://www.testingimages.com/grimace.jpg'}, this.callback); },
        'binary files' : function(err, resp, body) {
            assert.equal(body, fs.readFileSync(path.join(__dirname, 'fixtures', 'grimace.jpg'), 'binary'));
        }
    }
}).export(module);
