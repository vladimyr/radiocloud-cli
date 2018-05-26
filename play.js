'use strict';

const cp = require('child_process');
const opn = require('opn');
const platform = require('os').platform();
const run = require('run-applescript');
const tempWrite = require('temp-write');

const delay = ms => new Promise(resolve => setTimeout(() => resolve(), ms));
const isLinux = platform => platform === 'linux';
const isMacOS = platform => platform === 'darwin';
const spawn = (cmd, args) => cp.spawn(cmd, args, { stdio: 'ignore', detached: true });

const tempPlaylist = (stream, filename = 'radiocloud.pls') => tempWrite.sync(`
[playlist]
NumberOfEntries=1

File1=${stream.url}
Title1=${stream.name}
Length1=-1

Version=2
`, filename);

const playStream = (streamUrl, singleInstance = true) => run(`
tell application "QuickTime Player"
  ${(
    singleInstance && `
    if it is running and (exists document 1) then
      close document 1
    end if`
  )}
  open URL "${streamUrl}"
  return "QuickTime Player"
end tell`);

const hideApplication = app => run(`
tell application "Finder"
  set visible of process "${app}" to false
end tell`);

module.exports = function (stream) {
  if (isMacOS(platform)) {
    return playStream(stream.url)
      .then(async player => {
        await delay(1000);
        hideApplication(player);
      });
  }
  const playlist = tempPlaylist(stream);
  if (isLinux(platform)) {
    return playPlaylist('vlc', playlist)
      .catch(err => {
        if (err.code !== 'ENOENT') throw err;
        return opn(playlist, { wait: false });
      });
  }
  return opn(playlist, { wait: false });
};

function playPlaylist(app, playlist) {
  return new Promise((resolve, reject) => {
    const ps = spawn(app, [playlist]);
    ps.once('error', reject);
    ps.unref();
  });
}
