'use strict';

const fs = require('fs');
const opn = require('opn');
const platform = require('os').platform();
const run = require('run-applescript');
const tempWrite = require('temp-write');
const util = require('util');
const which = require('which');

const del = util.promisify(fs.unlink);
const delay = ms => new Promise(resolve => setTimeout(() => resolve(), ms));
const hasVLC = () => which.sync('vlc', { nothrow: true });
const isMacOS = platform => platform === 'darwin';

// NOTE: This "hack" is required for QuickTime Player
//       to show stream name as part of window title
const prettyUrl = ({ url, name }) => {
  return url.replace(/;?$/, encodeURIComponent(` # ${name}`));
};

const tempPlaylist = (stream, filename = 'radiocloud.pls') => tempWrite.sync(`
[playlist]
NumberOfEntries=1

File1=${stream.url}
Title1=${stream.name}
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
  set stream to first document
  set audio volume of stream to ${volume}
  return "${player}"
end tell`);

const hideApplication = app => run(`
tell application "Finder"
  set visible of process "${app}" to false
end tell`);

module.exports = function (stream) {
  if (isMacOS(platform)) {
    const player = 'QuickTime Player';
    return playStream(player, prettyUrl(stream))
      .then(() => delay(1000))
      .then(() => hideApplication(player));
  }
  if (hasVLC()) return playWithVLC(stream);
  const playlist = tempPlaylist(stream);
  opn(playlist, { wait: false });
  return delay(1000).then(() => del(playlist));
};

function playWithVLC(stream) {
  const flags = ['--one-instance', '--no-playlist-enqueue'];
  return opn(stream.url, {
    app: ['vlc', ...flags],
    wait: false
  });
}
