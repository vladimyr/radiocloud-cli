#!/usr/bin/env node

'use strict';

const client = require('ky-universal');
const diacritics = require('diacritics');
const fuzzysearch = require('fuzzysearch');
const inquirer = require('inquirer');
const pkg = require('./package.json');
const play = require('./play');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

const fetchStations = async (url = pkg.config.playlist) => {
  const resp = await client.get(url);
  const { playlist = {} } = await resp.json();
  return playlist.track || [];
};
const removeDiacritics = str => diacritics.remove(str.replace(/đ/g, 'dj'));
const normalize = str => removeDiacritics(str.toLowerCase().trim());

program().catch(err => { throw err; });

async function program() {
  const stations = await fetchStations();
  const station = await selectStation(stations);
  return play(station);
}

async function selectStation(stations) {
  stations = stations.map(station => {
    station.value = station;
    station.name = station.title;
    station.normalizedName = normalize(station.title);
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
