#!/usr/bin/env node

'use strict';

const diacritics = require('diacritics');
const fuzzysearch = require('fuzzysearch');
const got = require('got');
const inquirer = require('inquirer');
const pkg = require('./package.json');
const run = require('run-applescript');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

const fetchStations = async (url = pkg.config.stationsUrl) => {
  const { body: stations } = await got(url, { json: true });
  return stations;
};
const removeDiacritics = str => diacritics.remove(str.replace(/đ/g, 'dj'));
const normalize = str => removeDiacritics(str.toLowerCase().trim());

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

program().catch(err => { throw err; });

async function program() {
  const stations = await fetchStations();
  const station = await selectStation(stations);
  const player = await playStream(station.url);
  hideApplication(player);
}

async function selectStation(stations) {
  stations = stations.map(station => {
    station.value = station;
    station.normalizedName = normalize(station.name);
    return station;
  });
  const { station } = await inquirer.prompt([{
    type: 'autocomplete',
    name: 'station',
    message: 'Select station',
    pageSize: 10,
    source: async (_, input) => {
      if (!input) return stations;
      const needle = normalize(input);
      return stations.filter(station => fuzzysearch(needle, station.normalizedName));
    }
  }]);
  return station;
}
