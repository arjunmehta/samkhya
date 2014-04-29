/*!
 * samsaaraSocks - Connection Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var helper = require('../lib/helper.js');
var crypto = require('crypto');

var path = require("path");
var log = require("../lib/log.js");
var moduleName = path.basename(module.filename);
var samsaara;

var contexts = require('../lib/contextController.js').contexts;
var connections = require('../lib/connectionController.js').connections;

exports = module.exports = Connection;

exports.initialize = function(parent){
  samsaara = parent;
};


function Connection(conn, connID){

  this.id = connID;
  this.conn = conn;

  this.userID = 'anonymous' + helper.makeIdAlphaNumerical(5);
  this.key = helper.makeIdAlphaNumerical(20) + connID;

  this.token = helper.makeUniqueHash('sha1', this.key, [this.userID]);

  this.connectionClass = "native";

  this.initialized = false;
  this.initializeAttributes = {};

  this.lastHeartBeat = helper.getCurrentTime();

  this.navInfo = {
    connectionTimings: {
      latencies: [],
      measurableDifferences: [],
      clientOffsetGuesses: [],
      afterMin: 10000000000000000000,
      clientOffset: 0,
    },

    groups: [],

    timeOffset: 0,
    protocol: "",
    remoteAddress: "",

    windowWidth: 0,
    windowHeight: 0,
    geoposition: {}   
  };

  this.groups = [];

  this.context = null;
  this.foreignContext = null;
  this.owner = process.pid;

  this.routes = [];

}

Connection.prototype.addNewRoute = function(routeName){
  var i = 0;
  var routes = this.routes;
  while(routes[i] === undefined || routes[i] === null){

  }
  return routeID.toString(36);
};

Connection.prototype.getRoute = function(routeID){
  routeID = parseInt(routeID, 10);
  return this.routes[routeID];
};

Connection.prototype.removeRoute = function(routeID){
  routeID = parseInt(routeID, 10);
  this.routes[routeID] = undefined;
};

Connection.prototype.write = function(message){
  // console.log(process.pid.toString(), "NATIVE write on", "NATIVE CONNECTION WRITING");
  this.conn.write(message);
};

Object.defineProperty(Connection.prototype, 'currentContext', {
    get: function() {
        return contexts[this.context];
    },
    set: function(context) {
        this.context = context.contextID;
    }
});

Connection.prototype.receive = function(messageObj){

  var tokenMatch = (this.token === messageObj.token) || (this.oldToken === messageObj.token);

  if(messageObj.opts){
    log.info(process.pid, moduleName, messageObj.opts);
    connectionController.initializeConnection(this.id, messageObj.opts);
  }

  if(messageObj.login){
    this.loginConnection(messageObj);
  }

  if(messageObj.func){    
    if(tokenMatch){
      this.executeFunction(messageObj);
    }
    else{
      log.info(process.pid, moduleName, process.pid, "ERROR: Token Mismatch:", this.token, messageObj.token);
    }
  }
};

