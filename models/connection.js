/*!
 * samsaaraSocks - Connection Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

// var memwatch = require('memwatch');


var helper = require('../lib/helper');

var path = require("path");
var log = require("../lib/log");
var moduleName = path.basename(module.filename);

var samsaara = require('../index.js');
var config = require('../lib/config');

var communication = require('../lib/communication');
var connectionController = require('../lib/connectionController');
var router = require('../lib/router');

var connections = connectionController.connections;

exports = module.exports = Connection;


function Connection(conn){

  var connection = this;

  this.id = conn.id;
  this.conn = conn;

  this.owner = config.uuid;

  this.initializeAttributes = new InitializedAttributes(this);
  this.initialized = false;

  this.lastHeartBeat = 0;

  this.connectionData = {};

  for(var i=0; i < this.preInitializationMethods.length; i++){
    this.preInitializationMethods[i](connection);
  }

  conn.on('close', function (message){
    connection.closeConnection(message);
  });

  conn.on('data', function (message){
    connection.handleMessage(message);
  });

  conn.write(JSON.stringify(["init",{
    samsaaraID: connection.id,
    samsaaraOwner: config.uuid,
    samsaaraHeartBeat: connectionController.heartBeatThreshold
  }]));

  samsaara.emit("connect", this);
}


Connection.prototype.preInitializationMethods = [];

Connection.prototype.initializationMethods = [];

Connection.prototype.closingMethods = [];


/*
 * Method to update connectionData attribute on the connection. This method should be used when updating
 * the connection with new data, as it can be middlewared to broadcast changes, etc.
 */

Connection.prototype.updateDataAttribute = function(attributeName, value) {
  this.connectionData[attributeName] = value;
};


/*
 * Method to handle new socket messages.
 */

Connection.prototype.handleMessage = function(raw_message){

  // this.score = ((connectionController.globalBeat - this.lastHeartBeat) > 0 ? 20000 : 0 ) + (this.score > 20000 ? 20000 : this.score) - (raw_message.length);
  // console.log(this.score, connectionController.globalBeat, this.lastHeartBeat);

  this.lastHeartBeat = connectionController.globalBeat;

  switch(raw_message){
    case "H":
      console.log("Heartbeat...", this.id, this.lastHeartBeat, connectionController.globalBeat);
      break;
    default:
      router.newConnectionMessage(this, raw_message);
  }
};


/*
 * Method to handle new socket messages.
 */

Connection.prototype.write = function(message){
  // console.log(process.pid.toString(), "NATIVE write on", "NATIVE CONNECTION WRITING");
  this.conn.write(message);
};


/*
 * Connection close handler.
 */

Connection.prototype.closeConnection = function(message){
  // var hd = new memwatch.HeapDiff();
  ////////

  var connID = this.id;
  samsaara.emit("disconnect", this);

  for(var i=0; i < this.closingMethods.length; i++){
    this.closingMethods[i](this);
  }

  this.conn.removeAllListeners();
  delete connections[connID];

  log.warn(" ", config.uuid, moduleName, "CLOSING: ", connID, message);

  ////////
  // var diff = hd.end();
  // console.log(diff.change.details);
};


/*
 * Method to start the initialization process. Executed from the router, when the opts message is received.
 */

Connection.prototype.initialize = function(opts){

  console.log("Trying To Initialize Connection...", this.id);

  opts = opts || {};

  var connection = this;
  var ia = this.initializeAttributes;

  for(var i=0; i < this.initializationMethods.length; i++){
    this.initializationMethods[i](opts, connection, ia);
  }

  ia.ready = true;

};


/*
 * Method to finish the initialization process.
 */

Connection.prototype.completeInitialization = function(){
  if(this.initialized === false){
    console.log(config.uuid, this.id, "Initialized");
    communication.sendToClient(this.id, {internal: "samsaaraInitialized", args: [true]}, function (confirmation){
      this.connection.initialized = true;
      samsaara.emit('initialized', this.connection);
    });
  }
};


/*
 * A special object that manages the initialization of various attributes of the connection.
 */

function InitializedAttributes(connection){
  this.connection = connection;
  this.forced = {};
  this.count = 0;
  this.ready = false;
}

InitializedAttributes.prototype.force = function(attribute){
  this.forced[attribute] = false;
  // console.log("////////////////////////////////Forcing Attribute", this.forced);
};

InitializedAttributes.prototype.initialized = function(err, attribute){

  console.log("...Initialized attribute", attribute, this.forced);

  if(err) console.log(err);

  if(this.forced[attribute] !== undefined){
    this.forced[attribute] = true;

    if(this.allInitialized() === true){
      this.connection.completeInitialization();
    }
  }
};

InitializedAttributes.prototype.allInitialized = function(){
  var forced = this.forced;
  if(this.ready){
    for(var attr in forced){
      // console.log("////////////////////////////////CHECKING FORCED", attr, forced[attr], this.forced);
      if (forced[attr] === false) return false;
    }
  }
  return true;
};



var initializationMethods = {
  windowSize: windowSizeInitOptions
};

for(var ext in initializationMethods){
  Connection.prototype.initializationMethods.push(initializationMethods[ext]);
}






function windowSizeInitOptions(opts, connection, attributes){

  connection.updateDataAttribute("clientWindow", {});

  if(opts.windowSize !== undefined){
    console.log("Initializing Window Size...");
    if(opts.windowSize === "force") attributes.force("windowSize");
    communication.sendToClient(connection.id, {internal: "getWindowSize"}, windowResize);
  }
}

function windowResize(width, height, windowOffsetX, windowOffsetY){
  var connection = this.connection;
  connection.updateDataAttribute("clientWindow", {windowWidth: width, windowHeight: height, offsetX: windowOffsetX, offsetY: windowOffsetY});
  samsaara.emit('windowSize', connection, width, height, windowOffsetX, windowOffsetY);
}





function updateConnectionInfo(attributes, callBack){

  var whichOne = connection;
  log.debug(""+process.pid, moduleName, "UPDATING CONNECTION INFO", attributes, whichOne);

  for(var attr in attributes){
    whichOne[attr] = attributes[attr];
  }
  if(whichOne.connectionClass === "symbolic"){
    communication.sendToOwner(whichOne.id, whichOne.owner, {internal: "updateConnectionInfo", args: [attributes], specialKey: config.specialKey}, callBack);
  }
}

