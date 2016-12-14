# Node Fakeweb

A simple tool that will intercept requests made via `http(s).request` and
mikeal's `request` module and respond with dummy data.

This version requires node v4 or higher, as it makes use of various bits
of ES6 functionality. The 0.2.0 version of Fakeweb is compatible with
v0.x releases of node, and should be used instead for older
applications.

Heavily inspired by: https://github.com/chrisk/fakeweb

## Installation

```
npm install --save-dev node-fakeweb
```

## Basic Example

```
const request = require('request');
const fakeweb = require('node-fakeweb');

fakeweb.allowNetConnect = false;
fakeweb.registerUri({uri: 'http://www.testing.com:80/', body: 'Hello!'});
request.get({uri: 'http://www.testing.com:80/'}, (err, resp, body) => {
  console.log(body);
});
```

This will output:

```
[ctide ~]:~$ node test/test.js
Hello!
```

## Supported Functionality

This will intercept requests made using `request` or by using
`http.request` and `https.request`. Other libraries that internally use
those should be intercepted as well, but there's no guarantees.

#### Options

```
const fakeweb = require('node-fakeweb');

fakeweb.allowNetConnect = false; // default = true
```

Setting this value to false will cause fakeweb to throw an exception for
any web request that's made that isn't registered as one to intercept.
Helpful to ensure that you aren't missing any web requests.

```
const fakeweb = require('node-fakeweb');

fakeweb.allowLocalConnect = false; // default = true
```

By default, fakeweb will allow requests that go to localhost or
127.0.0.1 to pass through. Setting this to false will ensure that it
will throw exceptions for these as well.

```
const fakeweb = require('node-fakeweb');

fakeweb.ignoreUri({uri: 'http://www.google.com/'});
```

If you have allowNetConnect set to false, ignoring a URI will cause
fakeweb to pass through requests to that URI as normla.

#### Registering URIs

`registerUri` accepts an object that contains the various options for
intercepting a request.

Accepted options:

* `uri`: This can either be an exact URL or a regex that will be compared
against all requests.
* `method`: Defaults to 'ANY', but otherwise will only match requests
that have the method specified when registering the URI.
* `file`: This will respond with the contents of a file as a string
* `binaryFile`: This will respond with the contents of a file, but will
read it in as a binary file instead of a string
* `statusCode`: Status code can either be a number or an array. If given
an array, fakeweb will iterate over the status codes for subsequent
responses that match the uri.
* `headers`: An object that contains the various headers that should be
sent to the client.
* `contentType`: Sets the content type of the response.
* `body`: This can accept either a string or a function. If given a
string, that will be the body of the response. When given a function,
that function will be called and the return value of that function will
be set as the body of the response.
* `exception`: `true` will cause fakeweb to throw an ECONNREFUSED
exception instead of handling the request. Useful for testing failure
cases where the endpoint is unreachable.

#### Spies

A spy will be returned from registering a URI that can be used to verify
that a request has been made. It will also contain a counter that will
be incremented for each request that's been made.

```
const fakeweb = require('node-fakeweb');

let googleSpy = fakeweb.registerUri({uri: 'http://www.google.com/'});
// googleSpy == { used: false, useCount: 0 }
request.get('http://www.google.com/', function() {});

// googleSpy will now look like:
// { used: true, useCount: 1 }
```

It can also trap the data POSTed to the url, and include that in the spy:

```
let fakeweb = require('node-fakeweb');

let googleSpy = fakeweb.registerUri({uri: 'http://www.google.com/'});
// googleSpy == { used: false, useCount: 0 }
request.post({uri: 'http://www.google.com/', body: 'hello!'}, function() {});

// googleSpy will now look like:
// { used: true, useCount: 1, body: 'hello!', form: undefined }
```

## Contributing

Please make sure your pull request contains tests and passes linting
(`npm run lint`, `npm test`).
