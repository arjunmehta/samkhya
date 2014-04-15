/*!
 * argyleSocks - SymbolicConnection Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var helper = require('../lib/helper.js');
var crypto = require('crypto');

exports = module.exports = SymbolicConnection;
var redisPub;

function SymbolicConnection(symbolicData){
  this.id = symbolicData.nativeID;
  this.context = null;
  this.connectionClass = "symbolic";
  this.owner = symbolicData.owner;
  this.groups = symbolicData.groups;
  this.nativeID = symbolicData.nativeID;
  this.navInfo = symbolicData.navInfo;
  this.token = symbolicData.token;
}

exports.initialize = function(pub){
  redisPub = pub;
};

SymbolicConnection.prototype.write = function(message){
  console.log(process.pid.toString(), "SYMBOLIC write on", "SYMBOLIC CONNECTION PUBLISHING: Owner:", this.owner, this.nativeID);
  redisPub.publish(this.nativeID, message);
};