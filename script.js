'use strict';

const runScript = require('run-applescript');

const ERR_APP_NOT_RUNNING = -600;
const ERR_UNKNOWN = -2700;
const reCode = /\((-?\d+)\)$/;

module.exports = {
  run,
  ERR_APP_NOT_RUNNING,
  ERR_UNKNOWN
};

function run(script) {
  return runScript(script).catch(({ stderr = '' }) => {
    const { message, code } = parseError(stderr.trim());
    const err = new Error(message);
    err.code = code;
    return Promise.reject(err);
  });
}

function parseError(str) {
  const tokens = str.split(/:\s+/g);
  const message = tokens[3];
  const match = message.match(reCode);
  const code = parseInt(match && match[1], 10) || ERR_UNKNOWN;
  return { message, code };
}
