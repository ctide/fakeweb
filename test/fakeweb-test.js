'use strict';

const chai = require('chai');
const request = require('request');
const http = require('http');
const https = require('https');
const fakeweb = require('../src/fakeweb.js');
const fs = require('fs');
const path = require('path');
const events = require('events');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'README.md')).toString();

let spy, spy2, spy3;

console.error = function() {};
fakeweb.allowNetConnect = false;
chai.should();

describe('fakeweb', function() {
  beforeEach(function() {
    fakeweb.tearDown();
    fakeweb.allowNetConnect = false;
  });

  describe("will read a fixture from disk and return that", function() {
    it("when queried with request passing an object", function(done) {
      fakeweb.registerUri({uri: 'http://www.readme.com/', file: path.join(__dirname, 'fixtures', 'README.md')});
      request.get({uri: 'http://www.readme.com/'}, function(err, resp, body) {
        body.should.equal(fixture);
        done();
      });
    });

    it('and when queried using http', function(done) {
      let data = '';
      fakeweb.registerUri({uri: 'http://www.readme.com:90/', file: path.join(__dirname, 'fixtures', 'README.md')});
      var req = http.request({host: 'www.readme.com', port: '90', path: '/', method: 'GET'}, function(res) {
        res.on('data', function(chunk) {
          data += chunk;
        });
        res.on('close', function() {
          data.toString().should.equal(fixture);
          done();
        });
      });
      req.end();
    });
  });

  describe('will throw an exception with allowConnect off when you make', function() {
    it ('a GET request via request module', function() {
      let fun = function() { request.get({uri: 'http://www.test.com/'}); }
      fun.should.throw(/GET/);
    });

    it ('a POST request via request module', function() {
      let fun = function() { request.post({uri: 'http://www.test.com/'}); }
      fun.should.throw(/POST/);
    });

    it ('a request using the HTTP module', function() {
      let fun = function() { http.request({host: 'www.test.com', port: 80, path: '/', method: 'GET'}); }
      fun.should.throw(/GET/);
    });

    it ('a request using the HTTPS module', function() {
      let fun = function() { https.request({host: 'www.test.com', port: 80, path: '/', method: 'GET'}); }
      fun.should.throw(/GET/);
    });
  });

  it('will not fail to intercept calls made using request directly', function(done) {
    fakeweb.registerUri({uri: 'http://www.readme.com/', file: path.join(__dirname, 'fixtures', 'README.md')});
    request('http://www.readme.com/', function(err, resp, body) {
      body.should.equal(fixture);
      done();
    }); 
  });

  it('will allow connections to local resources if allowNetConnect is set to true', function() {
    fakeweb.allowLocalConnect = true;
    let fun = function() { request.get({uri: 'http://localhost:4324'}, function() {} ); }
    fun.should.not.throw();
  });

  it('will allow connections to URLs specifically defined as ignored when allowNetConnect is off', function() {
    fakeweb.ignoreUri({uri: 'http://www.google.com:80/'});
    let fun = function() { request.get({uri: 'http://www.google.com/'}, function() {} ); }
    fun.should.not.throw();
  });

  it ('will allow users to register a URI that will throw ECONNREFUSED with request', function() {
    fakeweb.registerUri({uri: 'http://www.google.com/exception', exception: true});
    let fun = function() { request.get({uri: 'http://www.google.com/exception'}, function() {} ); }
    fun.should.throw(/ECONNREFUSED/);
  });

  it ('will allow users to register a URI that will throw ECONNREFUSED via http module', function(done) {
    fakeweb.registerUri({uri: 'http://www.google.com:80/exception', exception: true});
    let req = http.request({host: 'www.google.com', port: '80', path: '/exception', method: 'GET'}, res => {
      res.on('error', function(err) {
        err.code.should.equal('ECONNREFUSED');
        done();
      });
    }); 
    req.end();
  });
});

//   "will allow users to register a URI that will throw" : {
//     topic: function() {
//       var self = this;
//       fakeweb.registerUri({uri: 'http://www.google.com:80/exception', exception: true});
//       var req = http.request({host: 'www.google.com', port: '80', path: '/exception', method: 'GET'}, function(res) {
//         res.on('error', function(err) {
//           self.callback(err);
//         });
//       });
//       req.end();
//     },
//     'ECONNREFUSED via http module': function(err, resp, data) {
//       assert.equal(err.code, 'ECONNREFUSED');
//     }
//   },
//   'will set content type ' : {
//     'with request' : {
//       topic: function() {
//         fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', contentType: 'testing'});
//         request.get({uri: 'http://www.contenttype.com:80/'}, this.callback); 
//       },
//       "correctly on the response" : function(err, resp, body) {
//         assert.equal(resp.headers['content-type'], 'testing');
//       }
//     },
//     'with http' : {
//       topic: function() {
//         fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', contentType: 'testing'});
//         var self = this;
//         var data = '';
//         var req = http.request({host: 'www.contenttype.com', port: '80', path: '/', method: 'GET'}, function(res) {
//           res.on('data', function(chunk) {
//             data += chunk;
//           });
//           res.on('close', function() {
//             self.callback(undefined, res, data);
//           });
//         });
//         req.end();
//       },
//       "correctly on the response" : function(err, resp, data) {
//         assert.equal(resp.headers['content-type'], 'testing');
//         assert.equal(data, 'body');
//       }
//     }
//   },
//   'can set arbitrary headers ' : {
//     'with request' : {
//       topic: function() {
//         fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', headers: {location: 'testing'}});
//         request.get({uri: 'http://www.contenttype.com:80/'}, this.callback); 
//       },
//       "correctly on the response" : function(err, resp, body) {
//         assert.equal(resp.headers['location'], 'testing');
//       }
//     },
//     'with http' : {
//       topic: function() {
//         fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', headers: {location: 'testing'}});
//         var self = this;
//         var data = '';
//         var req = http.request({host: 'www.contenttype.com', port: '80', path: '/', method: 'GET'}, function(res) {
//           res.on('data', function(chunk) {
//             data += chunk;
//           });
//           res.on('close', function() {
//             self.callback(undefined, res, data);
//           });
//         });
//         req.end();
//       },
//       "correctly on the response" : function(err, resp, data) {
//         assert.equal(resp.headers['location'], 'testing');
//         assert.equal(data, 'body');
//       }
//     }
//   },
//   "won't truncate " : {
//     topic: function() {
//       fakeweb.registerUri({uri: 'http://www.testingimages.com/grimace.jpg', binaryFile: path.join(__dirname, 'fixtures', 'grimace.jpg'), contentType: 'image/jpeg'});
//       request.get({uri: 'http://www.testingimages.com/grimace.jpg'}, this.callback); 
//     },
//     'binary files' : function(err, resp, body) {
//       assert.equal(body, fs.readFileSync(path.join(__dirname, 'fixtures', 'grimace.jpg'), 'binary'));
//     }
//   },
//   "will prefer hostname over host in http request options": {
//     topic: function() {
//       var self = this;
//       var data = '';
//       fakeweb.registerUri({uri: 'http://hostname.com:80/', body: 'hostname'});
//       var req = http.request({hostname: 'hostname.com', host: 'hostname.com:80', port: '80', path: '/', method: 'GET'}, function(res) {
//         res.on('data', function(chunk) {
//           data += chunk;
//         });
//         res.on('close', function() {
//           self.callback(undefined, res, data);
//         });
//       });
//       req.end();
//     },
//     "correctly on the response" : function(err, resp, body) {
//       assert.equal(resp.statusCode, 200);
//     }
//   },
//   "will prefer hostname over host in https request options": {
//     topic: function() {
//       var self = this;
//       var data = '';
//       fakeweb.registerUri({uri: 'https://hostname.com:80/', body: 'hostname'});
//       var req = https.request({hostname: 'hostname.com', host: 'hostname.com:80', port: '80', path: '/', method: 'GET'}, function(res) {
//         res.on('data', function(chunk) {
//           data += chunk;
//         });
//         res.on('close', function() {
//           self.callback(undefined, res, data);
//         });
//       });
//       req.end();
//     },
//     "correctly on the response" : function(err, resp, body) {
//       assert.equal(resp.statusCode, 200);
//     }
//   },
//   "returns a pipable object from pipe": {
//     topic: function() {
//       var self = this;
//       var outputStream = "";
//
//       fakeweb.registerUri({uri: "http://bitpay.com/api/rates", body: "spoofed value"});
//
//       var req = http.get("http://bitpay.com/api/rates", function(res) {
//         outputStream = res.pipe(fs.createWriteStream('tmpfile.txt'));
//         res.on('end', function() {
//           self.callback(undefined, res, outputStream);
//         });
//       });
//     },
//     "successfully" : function(err, resp, outputStream) {
//       assert.notEqual(typeof(outputStream), undefined);
//       fs.unlink('tmpfile.txt');
//       outputStream.close();
//     }
//   },
//   "works with http.get when just passing a url": {
//     topic: function() {
//       var self = this;
//       var data = "";
//
//       fakeweb.registerUri({uri: "http://bitpay.com/api/rates", body: "spoofed value"});
//
//       var req = http.get("http://bitpay.com/api/rates", function(res) {
//         res.on("data", function (chunk) { data += chunk; });
//         res.on('end', function() {
//           self.callback(undefined, res, data);
//         });
//       });
//     },
//     "successfully" : function(err, resp, body) {
//       assert.equal(body, 'spoofed value');
//     }
//
//   },
//   "matches regexes as well as actual urls": {
//     topic: function() {
//       var self = this;
//       var data = "";
//
//       fakeweb.registerUri({uri: /testing.com/, body: "Hello!"});
//       var req = http.get("http://testing.com/some_url", function(res) {
//         res.on("data", function (chunk) { data += chunk; });
//         res.on('end', function() {
//           self.callback(undefined, res, data);
//         });
//       });
//     },
//     "successfully" : function(err, resp, body) {
//       assert.equal(body, 'Hello!');
//     }
//   },
//   "works with https.get": {
//     topic: function() {
//       var self = this;
//       var data = "";
//
//       fakeweb.registerUri({uri: "https://bitpay.com/api/rates", body: "spoofed value"});
//
//       var req = https.get("https://bitpay.com/api/rates", function(res) {
//         res.on("data", function (chunk) { data += chunk; });
//         res.on('end', function() {
//           self.callback(undefined, res, data);
//         });
//       });
//     },
//     "successfully" : function(err, resp, body) {
//       assert.equal(body, 'spoofed value');
//     }
//   },
//   "works properly with request.post": {
//     topic: function() {
//       fakeweb.registerUri({uri: 'http://www.readme.com/', file: path.join(__dirname, 'fixtures', 'README.md'), method: 'POST', statusCode: 301});
//       request.post('http://www.readme.com/', this.callback);
//     },
//     "successfully" : function(err, resp, body) {
//       assert.equal(resp.statusCode, 301);
//       assert.equal(body, fixture);
//     }
//   },
//   "will pass on post-data to body-handler if it is a function": {
//     topic: function() {
//       fakeweb.registerUri({uri: 'http://www.readme.com/', body: function (postData){ return postData; }});
//       request.post({uri: 'http://www.readme.com/', form: {test: 'yes'}}, this.callback);
//     },
//     "successfully" : function(err, resp, body) {
//       assert.equal(resp.statusCode, 200);
//       assert.deepEqual(body, {test: 'yes'});
//     }
//   },
//   "will follow redirects": {
//     topic: function() {
//       fakeweb.registerUri({uri: 'http://redirect.com/redirect', statusCode: 301, headers: {Location: '/redirect-target'}, body: ''});
//       fakeweb.registerUri({uri: 'http://redirect.com/redirect-target', statusCode: 200, body: 'body'});
//       request.get({uri: 'http://redirect.com/redirect'}, this.callback); 
//     },
//     'with request' : function(err, resp, body) {
//       assert.equal(resp.statusCode, 200);
//       assert.equal(body, 'body');
//     }
//   },
//   "will not follow redirects if request option is set": {
//     topic: function() {
//       fakeweb.registerUri({uri: 'http://redirect.com/redirect', statusCode: 301, headers: {Location: '/redirect-target'}, body: ''});
//       fakeweb.registerUri({uri: 'http://redirect.com/redirect-target', statusCode: 200, body: 'body'});
//       request.get({uri: 'http://redirect.com/redirect', followRedirect: false}, this.callback); 
//     },
//     'with request' : function(err, resp, body) {
//       assert.equal(resp.statusCode, 301);
//     }
//   },
//   "will respect an array status codes with only one element": {
//     topic: function() {
//       fakeweb.registerUri({uri: 'http://status-codes.com/oneCodeArray', statusCode: [200] });
//       request.get({uri: 'http://status-codes.com/oneCodeArray' }, this.callback); 
//     },
//     'with request' : function(err, resp, body) {
//       assert.equal(resp.statusCode, 200);
//     }
//   },
//   "will respect an array status codes with multiple elements": {
//     topic: function() {
//       fakeweb.registerUri({uri: 'http://status-codes.com/twoCodeArray', statusCode: [200, 404] });
//       request.get({uri: 'http://status-codes.com/twoCodeArray' }, this.callback); 
//     },
//     'with two request' : function(err, resp, body) {
//       assert.equal(resp.statusCode, 200);
//
//       request.get({uri: 'http://status-codes.com/twoCodeArray' }, function(err, resp, body) {
//         assert.equal(resp.statusCode, 404);
//       });
//     }
//   },
//   "will respect an array status codes with multiple elements and will keep returning the last entry once we go over the whole array": {
//     topic: function() {
//       fakeweb.registerUri({uri: 'http://status-codes.com/twoCodeArray', statusCode: [200, 404] });
//       request.get({uri: 'http://status-codes.com/twoCodeArray' }, this.callback); 
//     },
//     'with three request' : function(err, resp, body) {
//       assert.equal(resp.statusCode, 200);
//
//       request.get({uri: 'http://status-codes.com/twoCodeArray' }, function(err, resp, body) {
//         assert.equal(resp.statusCode, 404);
//
//         request.get({uri: 'http://status-codes.com/twoCodeArray' }, function(err, resp, body) {
//           assert.equal(resp.statusCode, 404);
//         });
//       });
//     }
//   },
//   "will return a spy for easy testing": {
//     topic: function() {
//       spy = fakeweb.registerUri({uri: 'http://www.readme.com/', body: ''});
//       request.post({uri: 'http://www.readme.com/'}, this.callback);
//     },
//     "successfully" : function(err, resp, body) {
//       assert.equal(resp.statusCode, 200);
//       assert(spy.used);
//       assert.equal(spy.useCount, 1);
//     }
//   },
//   "will return a spy that contains posted data": {
//     topic: function() {
//       spy2 = fakeweb.registerUri({uri: 'http://www.readme.com/', body: ''});
//       request.post({uri: 'http://www.readme.com/', body: 'hi'}, this.callback);
//     },
//     "successfully": function(err, resp, body) {
//       assert.equal(spy2.body, 'hi');
//     }
//   },
//   'will return a spy from http.requests that contains posted data': {
//     topic: function() {
//       var self = this;
//       var data = '';
//       spy3 = fakeweb.registerUri({uri: 'http://www.readme.com:80/post', method: 'POST', body: 'hi'});
//       var req = http.request({host: 'www.readme.com', port: '80', path: '/post', method: 'POST'}, function(res) {
//         res.on('data', function(chunk) {
//           data += chunk;
//         });
//         res.on('close', function() {
//           self.callback(undefined, data);
//         });
//       });
//       req.write('hi', 'utf8', () => {
//         req.end();
//       });
//     },
//     "successfully": function(err, resp) {
//       assert.equal(resp, 'hi');
//       assert.equal(spy3.body, 'hi');
//     }
//   }
// }).export(module);
