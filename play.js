'use strict';

const { run, ERR_APP_NOT_RUNNING } = require('./script');
const fs = require('fs');
const opn = require('opn');
const os = require('os');
const red = require('ansi-red');
const tempWrite = require('temp-write');
const util = require('util');
const which = require('which');
const icy = require('./icy');

const del = util.promisify(fs.unlink);
const delay = ms => new Promise(resolve => setTimeout(() => resolve(), ms));
const hasVOX = () => fs.existsSync('/Applications/VOX.app');
const hasVLC = () => which.sync('vlc', { nothrow: true });
const isMacOS = () => os.platform() === 'darwin';

// NOTE: This "hack" is required for QuickTime Player
//       to show stream name as part of window title
const prettyUrl = ({ location, title }) => {
  return location.replace(/;?$/, encodeURIComponent(` # ${title}`));
};

const tempPlaylist = (stream, filename = 'radiocloud.pls') => tempWrite.sync(`
[playlist]
NumberOfEntries=1

File1=${stream.location}
Title1=${stream.title}
Length1=-1

Version=2
`, filename);

const playStream = (player, streamUrl, volume = 0.2, singleInstance = true) => run(`
tell application "${player}"
  ${(
    singleInstance && `
    if it is running and (exists document 1) then
      close document 1
    end if`
  )}
  open URL "${streamUrl}"
  delay 1
  set stream to first document
  set audio volume of stream to ${volume}
  return "${player}"
end tell`);

const hideApplication = app => run(`
tell application "Finder"
  set visible of process "${app}" to false
end tell`);

module.exports = function (stream) {
  const debug = require('debug')('playback');
  if (isMacOS() && hasVOX()) {
    debug({ url: stream.location });
    return playWithVOX(stream.location);
  }
  if (isMacOS()) {
    const player = 'QuickTime Player';
    return getStreamUrl(stream)
      .then(url => debug({ url }) || playStream(player, url))
      .then(() => delay(1000))
      .then(() => hideApplication(player))
      .catch(err => {
        if (err.code !== ERR_APP_NOT_RUNNING) return Promise.reject(err);
        const message = `Failed to open stream. Please close ${player} manually.`;
        console.log();
        console.error(red('Error:'), message);
      });
  }
  debug({ url: stream.location });
  if (hasVLC()) return playWithVLC(stream);
  const playlist = tempPlaylist(stream);
  opn(playlist, { wait: false });
  return delay(1000).then(() => del(playlist));
};

function playWithVOX(streamUrl, volume = 25) {
  const player = 'VOX';
  return run(`
    tell application "${player}"
      playURL "${streamUrl}"
      set player volume to ${volume}
    end tell
  `).then(() => hideApplication(player));
}

function playWithVLC(stream) {
  const flags = ['--one-instance', '--no-playlist-enqueue'];
  return opn(stream.location, {
    app: ['vlc', ...flags],
    wait: false
  });
}

function getStreamUrl(stream) {
  const debug = require('debug')('icy');
  const isError = resp => resp.statusCode >= 400 && resp.statusCode <= 500;
  return icy(prettyUrl(stream))
    .then(resp => {
      debug(resp);
      if (!isError(resp)) return resp.url;
      const err = new Error(resp.statusMessage);
      err.response = resp;
      return Promise.reject(err);
    })
    .catch(() => stream.location);
}
