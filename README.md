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
var request = require('request');
var fakeweb = require('node-fakeweb');
var output = function(err, resp, body) { console.log(body); }

fakeweb.allowNetConnect = false;
fakeweb.registerUri({uri: 'http://www.testing.com:80/', body: 'Hello!'});
request.get({uri: 'http://www.testing.com:80/'}, output);
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
var fakeweb = require('node-fakeweb');

fakeweb.allowNetConnect = false; // default = true
```

Setting this value to false will cause fakeweb to throw an exception for
any web request that's made that isn't registered as one to intercept.
Helpful to ensure that you aren't missing any web requests.

```
var fakeweb = require('node-fakeweb');

fakeweb.allowLocalConnect = false; // default = true
```

By default, fakeweb will allow requests that go to localhost or
127.0.0.1 to pass through. Setting this to false will ensure that it
will throw exceptions for these as well.

```
var fakeweb = require('node-fakeweb');

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

```
var fakeweb = require('node-fakeweb');

var googleSpy = fakeweb.registerUri({uri: 'http://www.google.com/'});
```


## Contributing

Please make sure your pull request contains tests and passes linting
(`npm run lint`, `npm test`).
