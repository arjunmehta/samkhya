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

  this.userID = 'anonymous' + helper.makeIdAlphaNumerical(5);
  this.key = helper.makeIdAlphaNumerical(20) + conn.id;
  this.token = helper.makeUniqueHash('sha1', this.key, [this.userID]);

  conn.on('close', function (message){
    connection.closeConnection(message);
  });

  conn.on('data', function (message){
    connection.handleMessage(message);
  });

  conn.write(JSON.stringify([config.uuid,{
    samsaaraID: conn.id, 
    samsaaraToken: connection.token,
    samsaaraOwner: config.uuid,
    samsaaraHeartBeat: connectionController.heartBeatThreshold
  }]));

  samsaara.emit("connect", this);

  if(config.redisStore === true){
    this.subscribeRedis();
  }

}


Connection.prototype.initializationMethods = [];


Connection.prototype.closingMethods = [];


Connection.prototype.handleMessage = function(raw_message){

  this.lastHeartBeat = connectionController.globalBeat;

  if(raw_message !== 'H'){    
    router.newConnectionMessage(this, raw_message);  
  }
  else{
    console.log("Heartbeat...", this.id, this.lastHeartBeat, connectionController.globalBeat);  
  }
};


Connection.prototype.initialize = function(opts){

  console.log("Trying To Initialize Connection...", this.id);

  opts = opts || {};

  var connection = this;
  var ia = this.initializeAttributes;
  
  for(var i=0; i < this.initializationMethods.length; i++){
    this.initializationMethods[i](opts, connection, ia);
  }
};


Connection.prototype.completeInitialization = function(){
  if(this.initialized === false){
    console.log(config.uuid, this.id, "Initialized");
    communication.sendToClient(this.id, {internal: "samsaaraInitialized", args: [true]}, function (confirmation){
      this.initialized = true;
      samsaara.emit('initialized', this);
    });
  }
};


Connection.prototype.closeConnection = function(message){
  // var hd = new memwatch.HeapDiff();
  ////////

  var connID = this.id;
  // var connContext = this.context;
  
  samsaara.emit("disconnect", this);

  // authentication.removeConnectionSession(connID);

  // if(connContext !== null && contexts[connContext] !== undefined){
  //   contexts[connContext].removeConnection(connID);
  // }

  // for(var key in groups){
  //   if(groups[key][connID] !== undefined){
  //     delete groups[key][connID];
  //   }
  // }

  // if(config.redisStore === true){
  //   this.unsubscribeRedis();
  // }

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


Connection.prototype.write = function(message){
  // console.log(process.pid.toString(), "NATIVE write on", "NATIVE CONNECTION WRITING");
  this.conn.write(message);
};



function InitializedAttributes(connection){
  this.connection = connection;
  this.forced = {};
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
  for(var attr in forced){
    // console.log("////////////////////////////////CHECKING FORCED", attr, forced[attr], this.forced);
    if (forced[attr] === false) return false;
  }
  return true;
};












var initializationMethods = {
  navInfo: navInfoInitOptions,
  timeOffset: timeOffsetInitOptions,
  geoLocation: geoLocationInitOptions,
  windowSize: windowSizeInitOptions
};

for(var ext in initializationMethods){
  Connection.prototype.initializationMethods.push(initializationMethods[ext]);
}


function navInfoInitOptions(opts, connection, attributes){

  connection.navInfo = {};

  console.log("Initializing NavInfo...");
  attributes.force("navInfo");
  communication.sendToClient(connection.id, {internal: "getNavInfo"}, function getNavInfo(navInfo){

    var connNavInfo = this.navInfo;
    for(var key in navInfo){
      connNavInfo[key] = navInfo[key];
    }

    attributes.initialized(null, "navInfo");
  });
}


function timeOffsetInitOptions(opts, connection, attributes){

  connection.timeOffset = null;

  connection.connectionTimings = {
      latencies: [],
      measurableDifferences: [],
      clientOffsetGuesses: [],
      afterMin: 10000000000000000000,
      clientOffset: 0,
      timeAccuracy: 7
    };

  if(opts.timeOffset !== undefined){
    console.log("Initializing Time Offset...");
    if(opts.timeOffset === "force") attributes.force("timeOffset");
    testTime(connection.id);
  }
}


function geoLocationInitOptions(opts, connection, attributes){
  if(opts.geoLocation !== undefined){
    console.log("Initializing geoLocation...");
    if(opts.geoLocation === "force") attributes.force("geoLocation");
    communication.sendToClient(connection.id, {internal: "getGeoLocation"}, geoPosition);
  }
}


function windowSizeInitOptions(opts, connection, attributes){

  connection.clientWindow = {};

  if(opts.windowSize !== undefined){
    console.log("Initializing Window Size...");
    if(opts.windowSize === "force") attributes.force("windowSize");
    communication.sendToClient(connection.id, {internal: "getWindowSize"}, windowResize);
  }
}



//CONNECTION's INFO FUNCTIONS
function testTime (connID){
  // console.log("Testing Time...");
  var currentTime = new Date().getTime();
  if(connections[connID].connectionTimings.afterMin < 10000000000){
    communication.sendToClient(connID, {internal: "testTime", args:[( connections[connID].connectionTimings.afterMin ), currentTime]}, testTimeReturn);
  }
  else{
    communication.sendToClient(connID, {internal: "testTime", args:[0, currentTime]}, testTimeReturn);
  }
}



function testTimeReturn (originalTime, clientTime, timeError){

  var currentTime = new Date().getTime();
  var latency = currentTime - originalTime;
  var measurableDifference = currentTime - clientTime;

  // console.log(this.navInfo, originalTime, clientTime, timeError, "//////////////////////////////////////////////////////////////////////////////////////////////////////");

  if(this.connectionTimings.latencies.length > this.connectionTimings.timeAccuracy){
    this.connectionTimings.latencies.shift();
    this.connectionTimings.measurableDifferences.shift();
    this.connectionTimings.clientOffsetGuesses.shift();
  }

  this.connectionTimings.latencies.push( latency );
  this.connectionTimings.measurableDifferences.push( measurableDifference );

  var currenAfterMin = helper.min(this.connectionTimings.measurableDifferences);
  if (currenAfterMin < this.connectionTimings.afterMin) {
    this.connectionTimings.afterMin = currenAfterMin;
  }

  var lagBehind = latency - timeError;

  if(this.connectionTimings.latencies.length > 2){
    this.connectionTimings.clientOffsetGuesses.push( measurableDifference - lagBehind );
  }

  this.connectionTimings.clientOffset = helper.median(this.connectionTimings.clientOffsetGuesses);

  if(this.connectionTimings.latencies.length < this.connectionTimings.timeAccuracy){
    testTime(this.id);
  }
  else{
    console.log(""+process.pid, moduleName, this.id, "Time Offset:", this.connectionTimings.clientOffset);
    this.timeOffset = this.connectionTimings.clientOffset;
    communication.sendToClient(this.id, {internal: "updateOffset", args: [this.connectionTimings.clientOffset]});
    this.initializeAttributes.initialized(null, "timeOffset");
    delete this.connectionTimings;
  }

}





function windowResize(width, height, windowOffsetX, windowOffsetY){
  //this is the connection that returns the message

  this.clientWindow.windowWidth = width;
  this.clientWindow.windowHeight = height;

  if(windowOffsetX){
    samsaara.emit('windowSize', this, width, height, windowOffsetX, windowOffsetY);
  }
  else{
    samsaara.emit('windowSize', this, width, height);
  }
}


function geoPosition(err, geoposition){
  //this is the connection that returns the message
  if(this.conn !== undefined){
    this.geoposition = geoposition;
    this.initializeAttributes.initialized(err, "geoLocation");
    samsaara.emit('geoPosition', this, err, geoposition);
  }
  else{
    this.initializeAttributes.initialized(new Error("GeoLocation did not work"), "geoLocation");
    console.log("geoPosition Retrieval Error", this);
  }
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

