# Node Fakeweb

A simple tool that will intercept requests made via http.request and
mikeal's request module and respond with dummy data.

Heavily inspired by: https://github.com/chrisk/fakeweb

## Installation

```
npm install node-fakeweb
```

## Basic Examples

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
[ctide ~]:~$ node test.js
Hello!
```
