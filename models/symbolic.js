/*!
 * samsaaraSocks - SymbolicConnection Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var helper = require('../lib/helper.js');
var crypto = require('crypto');

var config = require('../lib/config');
var contexts = require('../lib/contextController.js').contexts;

var redisPub = config.redisPub;

exports = module.exports = SymbolicConnection;

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

SymbolicConnection.prototype.write = function(message){
  console.log(process.pid.toString(), "SYMBOLIC write on", "SYMBOLIC CONNECTION PUBLISHING: Owner:", this.owner, this.nativeID);
  redisPub.publish("NTV:"+this.nativeID, message);
};

Object.defineProperty(SymbolicConnection.prototype, 'currentContext', {
    get: function() {
        return contexts[this.context];
    },
    set: function(context) {
        this.context = context.contextID;
    }
});