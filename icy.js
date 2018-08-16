'use strict';

const http = require('http');
const httpHeaders = require('http-headers');

const ERR_CLOSE_SOCKET = 'ERR_CLOSE_SOCKET';
const reDelimeter = /\r?\n\r?\n/;

const isFunction = arg => typeof arg === 'function';
const pick = (obj, props = []) => props.reduce((acc, prop) => {
  return Object.assign(acc, { [prop]: obj[prop] });
}, {});

module.exports = promisify(icy);

function icy(url, cb) {
  http.get(url)
    .once('socket', socket => {
      let headers = '';
      socket.removeAllListeners('data');
      socket.on('data', data => {
        headers += data.toString();
        const match = headers.match(reDelimeter);
        if (!match) return;
        headers = headers.substring(0, match.index);
        cb(null, { url, ...parseHeaders(headers) });
        destroy(socket);
      });
    })
    .once('error', err => {
      if (err.code === ERR_CLOSE_SOCKET) return;
      cb(err);
    });
}

function parseHeaders(headers) {
  const parsed = httpHeaders(headers.replace(/ICY/g, 'HTTP/1.1'));
  if (!parsed.headers) return { headers: parsed };
  return pick(parsed, ['statusCode', 'statusMessage', 'headers']);
}

function destroy(socket) {
  const err = new Error('socket is closed');
  err.code = ERR_CLOSE_SOCKET;
  socket.destroy(err);
}

function promisify(fn) {
  return function (...args) {
    const cb = args[args.length - 1];
    return new Promise((resolve, reject) => {
      fn(...args, (err, data) => {
        if (err) {
          if (isFunction(cb)) cb(err);
          return reject(err);
        }
        if (isFunction(cb)) cb(null, data);
        return resolve(data);
      });
    });
  };
}
