/*!
 * Samsaara - Connection Initialization Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = new ConnectionController();

var path = require('path');
var moduleName = path.basename(module.filename);

var crypto = require('crypto');
var helper = require('./helper.js');
var log = require('./log.js');

var config = require('./config.js');
var communication = require('./communication.js');
var contextController = require('./contextController.js');
var authentication = require('./authentication.js');
var grouping = require('./grouping.js');

var Connection = require('../models/connection.js');

var groups = grouping.groups;
var contexts = contextController.contexts;

var connections,
    timeAccuracy;

function ConnectionController(){
  connections = this.connections = {};
  this.Connection = Connection;

  timeAccuracy = 7;
  setInterval(checkForDeadConnections, 25000);
}

function checkForDeadConnections(){

  var heartBeatThreshold = config.options.heartBeatThreshold || 11000;
  var currentTimeOutTime = helper.getCurrentTime() - heartBeatThreshold;
  var conn;

  for(var connID in connections){
    conn = connections[connID];
    // console.log(""+process.pid, new Date().toTimeString(), "CONNECTION Alive:", conn.id, conn.connectionClass);
    if(conn.connectionClass === "native" && conn.lastHeartBeat < currentTimeOutTime){
      conn.conn.close(111, "Flatlining Connection");
    }
  }
}

ConnectionController.prototype.createNewConnection = function(conn){

  var currentID = conn.id;

  connections[currentID] = new Connection(conn, currentID);

  conn.write(JSON.stringify([config.uuid,{
    samsaaraID: currentID, 
    samsaaraToken: connections[currentID].token, 
    samsaaraOwner: config.uuid
  }]));

  grouping.addToGroup(currentID, "everyone");

  if(config.redisStore === true){
    communication.newConnection(currentID);
  }

  config.emit("connect", connections[currentID]);

  conn.on('close', function (message){
    removeConnection(this.id, message);
  });

  conn.on('data', function (message){
    communication.router(connections[this.id], message);
  });
};





var removeConnection = ConnectionController.prototype.removeConnection = function(connID, message, callBack){

  var conn = connections[connID];
  var connContext = conn.context;
  
  log.warn(" ", process.pid, moduleName, "CLOSING: ", connID);  

  //REDIS DELETE
  if(config.redisStore === true){
    communication.closeConnection(connID);
  }

  authentication.removeConnectionSession(connID);

  if(connContext !== null && contexts[connContext] !== undefined){
    contexts[connContext].removeConnection(connID);
  }

  for(var key in groups){
    if(groups[key][connID] !== undefined){
      delete groups[key][connID];
    }
  }

  config.emit("disconnect", conn);

  connections[connID] = null;
  delete connections[connID];  
};

//CONNECTION FUNCTIONS////////////////////////////////////////////////////////////////////////////
ConnectionController.prototype.initializeConnection = function (connID, opts){

  console.log(""+process.pid, moduleName, connID, "//////////INITIALIZING WITH OPTIONS", opts);

  var whichOne = connections[connID];
  var ia = whichOne.initializeAttributes;
  ia.navInfo = false;

  if(opts !== undefined){

    if(opts.groups !== undefined){
      ia.groups = false;
      grouping.addToGroup(whichOne.id, opts.groups, function (addedGroups){
        doneInitializeConnection(connID, "groups");
      });
    }

    if(opts.timeOffset !== undefined){
      if(opts.timeOffset === "force") ia.timeOffset = false;
      testTime(connID);
    }
      
    if(opts.geoLocation !== undefined){
      if(opts.geoLocation === "force") ia.geoLocation = false;
      communication.sendToClient(connID, {internal: "getGeoLocation"}, geoPosition);
    }

    if(opts.windowSize !== undefined){
      if(opts.windowSize === "force") ia.windowSize = false;
      communication.sendToClient(connID, {internal: "getWindowSize"}, windowResize);
    }
  }

  communication.sendToClient(connID, {internal: "getNavInfo"}, getNavInfo); 
};


function allInitialized(ia){
  for(var attr in ia){
    if (ia[attr] === false) return false;
  }
  return true;
}


var doneInitializeConnection = ConnectionController.prototype.doneInitializeConnection = function (connID, whatInitialized){

  var whichOne = connections[connID];
  var ia = whichOne.initializeAttributes;

  if(ia[whatInitialized] !== undefined){
    ia[whatInitialized] = true;
  }

  console.log(""+process.pid, moduleName, connID, whatInitialized, "INITIALIZED");

  if(allInitialized(ia)){
    if(whichOne.initialized === false){
      communication.sendToClient(connID, {internal: "samsaaraInitialized", args: [true]}, function (confirmation){
        whichOne.initialized = true;
        config.emit('initialized', whichOne);
      });
    }
  }

};


//CONNECTION's INFO FUNCTIONS
var testTime = ConnectionController.prototype.testTime = function (connID){
  var currentTime = new Date().getTime();
  if(connections[connID].navInfo.connectionTimings.afterMin < 10000000000){
    communication.sendToClient(connID, {internal: "testTime", args:[( connections[connID].navInfo.connectionTimings.afterMin ), currentTime]}, testTimeReturn);
  }
  else{
    communication.sendToClient(connID, {internal: "testTime", args:[0, currentTime]},  testTimeReturn);
  }
};



function testTimeReturn (originalTime, clientTime, timeError){

  //'this' is the connection that returns the message

  var currentTime = new Date().getTime();
  var latency = currentTime - originalTime;
  var measurableDifference = currentTime - clientTime;

  if(this.navInfo.connectionTimings.latencies.length > timeAccuracy){
    this.navInfo.connectionTimings.latencies.shift();
    this.navInfo.connectionTimings.measurableDifferences.shift();
    this.navInfo.connectionTimings.clientOffsetGuesses.shift();
  }

  // console.log(" ", process.pid, moduleName, this.id, "original:", originalTime, "client:", clientTime, "error:", timeError, "measurableDiff:", measurableDifference, "latency:", latency);

  this.navInfo.connectionTimings.latencies.push( latency );
  this.navInfo.connectionTimings.measurableDifferences.push( measurableDifference );

  var currenAfterMin = helper.min(this.navInfo.connectionTimings.measurableDifferences);
  if (currenAfterMin < this.navInfo.connectionTimings.afterMin) {
    this.navInfo.connectionTimings.afterMin = currenAfterMin;
  }

  var lagBehind = latency - timeError;

  if(this.navInfo.connectionTimings.latencies.length > 2){
    this.navInfo.connectionTimings.clientOffsetGuesses.push( measurableDifference - lagBehind );
  }

  this.navInfo.connectionTimings.clientOffset = helper.median(this.navInfo.connectionTimings.clientOffsetGuesses);

  if(this.navInfo.connectionTimings.latencies.length < timeAccuracy){
    testTime(this.id);
  }
  else{
    console.log(""+process.pid, moduleName, this.id, "Time Offset:", this.navInfo.connectionTimings.clientOffset);
    this.navInfo.timeOffset = this.navInfo.connectionTimings.clientOffset;
    communication.sendToClient(this.id, {internal: "updateOffset", args: [this.navInfo.connectionTimings.clientOffset]});
    doneInitializeConnection(this.id, "timeOffset");
  }

}


var getNavInfo = ConnectionController.prototype.getNavInfo = function (navInfo){

  //'this' is the connection that returns the message
  var connNavInfo = this.navInfo;

  for(var key in navInfo){
    connNavInfo[key] = navInfo[key];
  }

  connNavInfo.remoteAddress = this.remoteAddress;
  connNavInfo.protocol = this.protocol;

  doneInitializeConnection(this.id, "navInfo");
};


var windowResize = ConnectionController.prototype.windowResize = function (width, height, windowOffsetX, windowOffsetY){
  //this is the connection that returns the message

  this.navInfo.windowWidth = width;
  this.navInfo.windowHeight = height;

  if(windowOffsetX){
    config.emit('windowSize', this, width, height, windowOffsetX, windowOffsetY);
  }
  else{
    config.emit('windowSize', this, width, height);
  }
};


var geoPosition = ConnectionController.prototype.geoPosition = function (err, geoposition){
  //this is the connection that returns the message
  if(this.navInfo !== undefined){
    this.navInfo.geoposition = geoposition;
    doneInitializeConnection(this.id, "geoLocation");
    config.emit('geoPosition', this, err, geoposition);
  }
  else{
    console.log("geoPosition Retrieval Error", this);
  }
};


var updateConnectionInfo = ConnectionController.prototype.updateConnectionInfo = function (attributes, callBack){

  var whichOne = this;
  log.debug(""+process.pid, moduleName, "UPDATING CONNECTION INFO", attributes, whichOne);

  for(var attr in attributes){
    whichOne[attr] = attributes[attr];
  }
  if(whichOne.connectionClass === "symbolic"){
    communication.sendToOwner(whichOne.id, whichOne.owner, {internal: "updateConnectionInfo", args: [attributes], specialKey: config.specialKey}, callBack);
  }
};

