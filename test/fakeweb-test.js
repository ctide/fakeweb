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
const should = chai.should();

let data;

console.error = () => {};
fakeweb.allowNetConnect = false;

describe('fakeweb', () => {
  beforeEach(() => {
    data = '';
    fakeweb.tearDown();
    fakeweb.allowNetConnect = false;
  });

  describe("will read a fixture from disk and return that", () => {
    it("when queried with request passing an object", done => {
      fakeweb.registerUri({uri: 'http://www.readme.com/', file: path.join(__dirname, 'fixtures', 'README.md')});
      request.get({uri: 'http://www.readme.com/'}, (err, resp, body) => {
        body.should.equal(fixture);
        done();
      });
    });

    it('and when queried using http', done => {
      fakeweb.registerUri({uri: 'http://www.readme.com:90/', file: path.join(__dirname, 'fixtures', 'README.md')});
      var req = http.request({host: 'www.readme.com', port: '90', path: '/', method: 'GET'}, res => {
        res.on('data', chunk => { data += chunk; });
        res.on('close', () => {
          data.toString().should.equal(fixture);
          done();
        });
      });
      req.end();
    });
  });

  describe('will throw an exception with allowConnect off when you make', () => {
    it ('a GET request via request module', () => {
      let fun = () => { request.get({uri: 'http://www.test.com/'}); }
      fun.should.throw(/GET/);
    });

    it ('a POST request via request module', () => {
      let fun = () => { request.post({uri: 'http://www.test.com/'}); }
      fun.should.throw(/POST/);
    });

    it ('a request using the HTTP module', () => {
      let fun = () => { http.request({host: 'www.test.com', port: 80, path: '/', method: 'GET'}); }
      fun.should.throw(/GET/);
    });

    it ('a request using the HTTPS module', () => {
      let fun = () => { https.request({host: 'www.test.com', port: 80, path: '/', method: 'GET'}); }
      fun.should.throw(/GET/);
    });
  });

  it('will not fail to intercept calls made using request directly', done => {
    fakeweb.registerUri({uri: 'http://www.readme.com/', file: path.join(__dirname, 'fixtures', 'README.md')});
    request('http://www.readme.com/', (err, resp, body) => {
      body.should.equal(fixture);
      done();
    }); 
  });

  it('will allow connections to local resources if allowNetConnect is set to true', () => {
    fakeweb.allowLocalConnect = true;
    let fun = () => { request.get({uri: 'http://localhost:4324'}, () => {} ); }
    fun.should.not.throw();
  });

  it('will allow connections to URLs specifically defined as ignored when allowNetConnect is off', () => {
    fakeweb.ignoreUri({uri: 'http://www.google.com:80/'});
    let fun = () => { request.get({uri: 'http://www.google.com/'}, () => {} ); }
    fun.should.not.throw();
  });

  it('will allow users to register a URI that will throw ECONNREFUSED with request', () => {
    fakeweb.registerUri({uri: 'http://www.google.com/exception', exception: true});
    let fun = () => { request.get({uri: 'http://www.google.com/exception'}, () => {} ); }
    fun.should.throw(/ECONNREFUSED/);
  });

  it('will allow users to register a URI that will throw ECONNREFUSED via http module', done => {
    fakeweb.registerUri({uri: 'http://www.google.com:80/exception', exception: true});
    let req = http.request({host: 'www.google.com', port: '80', path: '/exception', method: 'GET'}, res => {
      res.on('error', err => {
        err.code.should.equal('ECONNREFUSED');
        done();
      });
    }); 
    req.end();
  });

  describe('will set content type', () => {
    it('with request', done => {
      fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', contentType: 'testing'});
      request.get({uri: 'http://www.contenttype.com:80/'}, (err, resp, body) => {
        resp.headers['content-type'].should.equal('testing');
        done();
      });
    });

    it ('with http module', done => {
      fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', contentType: 'testing'});
      let req = http.request({host: 'www.contenttype.com', port: '80', path: '/', method: 'GET'}, res => {
        res.on('data', chunk => { data += chunk; });
        res.on('close', () => {
          res.headers['content-type'].should.equal('testing');
          data.should.equal('body');
          done();
        });
      });
      req.end();
    });
  });

  describe('can set arbitrary headers', () => {
    it('with request', done => {
      fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', headers: {location: 'testing'}});
      request.get({uri: 'http://www.contenttype.com:80/'}, (err, resp, body) => {
        resp.headers['location'].should.equal('testing');
        done();
      });
    });

    it('with http', done => {
      fakeweb.registerUri({uri: 'http://www.contenttype.com:80/', body: 'body', headers: {location: 'testing'}});
      let req = http.request({host: 'www.contenttype.com', port: '80', path: '/', method: 'GET'}, res => {
        res.on('data', chunk => { data += chunk; });
        res.on('close', () => {
          res.headers['location'].should.equal('testing');
          data.should.equal('body');
          done();
        });
      });
      req.end();
    });
  });

  it("won't truncate binary files", done => {
    fakeweb.registerUri({uri: 'http://www.testingimages.com/grimace.jpg', binaryFile: path.join(__dirname, 'fixtures', 'grimace.jpg'), contentType: 'image/jpeg'});
    request.get({uri: 'http://www.testingimages.com/grimace.jpg'}, (err, resp, body) => {
      body.should.equal(fs.readFileSync(path.join(__dirname, 'fixtures', 'grimace.jpg'), 'binary'));
      done();
    });
  });

  it('returns a pipable object from pipe', done => {
    let outputStream = '';
    fakeweb.registerUri({uri: 'http://bitpay.com/api/rates', body: 'spoofed value'});
    let req = http.get('http://bitpay.com/api/rates', res => {
      outputStream = res.pipe(fs.createWriteStream('tmpfile.txt'));
      res.once('end', () => {
        should.exist(typeof(outputStream));
        fs.unlink('tmpfile.txt');
      });
    });
    req.end();
    done();
  });

  it('works properly with http.get', done => {
    fakeweb.registerUri({uri: 'http://bitpay.com/api/rates', body: 'spoofed value'});

    let req = http.get('http://bitpay.com/api/rates', res => {
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        data.should.equal('spoofed value');
        done();
      });
    });
  });

  it('works properly with https.get', done => {
    fakeweb.registerUri({uri: 'https://bitpay.com/api/rates', body: 'spoofed value'});

    let req = https.get('https://bitpay.com/api/rates', res => {
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        data.should.equal('spoofed value');
        done();
      });
    });
    req.end();
  });

  it('matches regexes as well as regular urls', done => {
    fakeweb.registerUri({uri: /testing.com/, body: 'Hello!'});
    let req = http.get('http://testing.com/some_url', res => {
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        data.should.equal('Hello!');
        done();
      });
    });
    req.end();
  });

  it('works properly with request.post', done => {
    fakeweb.registerUri({uri: 'http://www.readme.com/', file: path.join(__dirname, 'fixtures', 'README.md'), method: 'POST', statusCode: 301});
    request.post('http://www.readme.com/', (err, resp, body) => {
      resp.statusCode.should.equal(301);
      body.should.equal(fixture);
      done();
    });
  });

  it('will pass on posted data to body-handler if it is a function', done => {
    fakeweb.registerUri({uri: 'http://www.readme.com/', body: postData => { return postData; } });
    request.post({uri: 'http://www.readme.com/', form: {test: 'yes'}}, (err, resp, body) => {
      resp.statusCode.should.equal(200);
      body.test.should.equal('yes');
      done();
    });
  });

  it('will follow redirects', done => {
    fakeweb.registerUri({uri: 'http://redirect.com/redirect', statusCode: 301, headers: {Location: '/redirect-target'}, body: ''});
    fakeweb.registerUri({uri: 'http://redirect.com/redirect-target', statusCode: 200, body: 'body'});
    request.get({uri: 'http://redirect.com/redirect'}, (err, resp, body) => {
      resp.statusCode.should.equal(200);
      body.should.equal('body');
      done();
    });
  });

  it('will not follow redirects if request option is set', done => {
    fakeweb.registerUri({uri: 'http://redirect.com/redirect', statusCode: 301, headers: {Location: '/redirect-target'}, body: ''});
    fakeweb.registerUri({uri: 'http://redirect.com/redirect-target', statusCode: 200, body: 'body'});
    request.get({uri: 'http://redirect.com/redirect', followRedirect: false}, (err, resp, body) => {
      resp.statusCode.should.equal(301);
      body.should.not.equal('body');
      done();
    });
  });

  it('will work with an array of status codes', done => {
    fakeweb.registerUri({uri: 'http://status-codes.com/oneCodeArray', statusCode: [200] });
    request.get({uri: 'http://status-codes.com/oneCodeArray'}, (err, resp, body) => {
      resp.statusCode.should.equal(200);
      done();
    });
  });

  it('will work through all the status codes in order, then continue to return the last value', done => {
    fakeweb.registerUri({uri: 'http://status-codes.com/twoCodeArray', statusCode: [200, 404] });
    request.get({uri: 'http://status-codes.com/twoCodeArray' }, (err, resp, body) => {
      resp.statusCode.should.equal(200);
      request.get({uri: 'http://status-codes.com/twoCodeArray' }, (err, resp, body) => {
        resp.statusCode.should.equal(404);
        request.get({uri: 'http://status-codes.com/twoCodeArray' }, (err, resp, body) => {
          resp.statusCode.should.equal(404);
          done();
        });
      });
    });
  });

  describe('supports spies', () => {
    it('that will be returned for easy testing', done => {
      let spy = fakeweb.registerUri({uri: 'http://www.readme.com/', body: ''});
      request.post({uri: 'http://www.readme.com/'}, (err, resp, body) => {
        resp.statusCode.should.equal(200);
        spy.used.should.equal(true);
        spy.useCount.should.equal(1);
        done();
      });
    });

    it('that contain the posted data', done => {
      let spy = fakeweb.registerUri({uri: 'http://www.readme.com/', body: ''});
      request.post({uri: 'http://www.readme.com/', body: 'hi'}, (err, resp, body) => {
        spy.body.should.equal('hi');
        done();
      });
    });

    it('that work properly for request made with http as well', done => {
      let spy = fakeweb.registerUri({uri: 'http://www.readme.com/post', method: 'POST', body: 'hi'});
      let req = http.request({host: 'www.readme.com', port: '80', path: '/post', method: 'POST'}, res => {
        res.on('data', chunk => { data += chunk; });
        res.on('close', () => {
          data.should.equal('hi');
          spy.body.should.equal('hello');
          done();
        });
      });
      req.write('hello', 'utf8', () => {
        req.end();
      });
    });
  });
});
