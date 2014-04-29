/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var helper = require('./helper.js');
var uuid = require('uuid');

var config = {
  options: {},
  redisStore: false,
  processID: process.pid,
  uuid: helper.makeIdAlphaNumerical(8)
};

exports = module.exports = config;