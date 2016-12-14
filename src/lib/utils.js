const url = require('url');

module.exports.parseUrl = (uri) => {
  const tempUrl = url.parse(uri);
  if (!tempUrl.port) {
    if (tempUrl.protocol === 'http:') {
      tempUrl.host += ":80";
    } else if (tempUrl.protocol === 'https:') {
      tempUrl.host += ":443";
    }
  }
  return url.format(tempUrl);
};

module.exports.getStatusCode = (options) => {
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
};
