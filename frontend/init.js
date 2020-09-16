/** This script declares simple utilities and load configs */

let log     = console.log;
let debug   = console.log;
let assert  = console.assert;
let entries = Object.entries;

// The config is a promise, it is now and it will always be
let configPromise = fetch("config.json").then(res => res.json());
