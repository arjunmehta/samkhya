/*!
 * Samsaara - Connection Initialization Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = new ConnectionController();

var path = require("path");
var log = require("./log.js");
var moduleName = path.basename(module.filename);

var crypto = require("crypto");

var helper = require("./helper.js");
var config = require("./config.js");

var communication = require("./communication.js");
var authentication = require("./authentication.js");

var Connection = require('../models/connection.js');
  
var samsaara;
var connectionController;
var connections;
var timeAccuracy;

function ConnectionController(){
  connectionController = this;
  connections = this.connections = {};

  timeAccuracy = 7;
}

ConnectionController.prototype.initialize = function(parent){
  samsaara = parent;
  this.Connection = Connection;
  
  setInterval(heartBeater, 25000);
};

function heartBeater(){

  var heartBeatThreshold = config.options.heartBeatThreshold || 11000;
  var currentTimeOutTime = helper.getCurrentTime() - heartBeatThreshold;
  var conn;

  for(var connection in connections){
    conn = connections[connection];
    console.log(process.pid, new Date().toTimeString(), "CONNECTION Alive:", conn.id, conn.connectionClass);
    if(conn.connectionClass === "native" && conn.lastHeartBeat < currentTimeOutTime){
      conn.conn.close(111, "Flatlining Connection");
    }
  }
}


var createNewConnection = ConnectionController.prototype.createNewConnection = function(conn){

  var currentID = conn.id;

  connections[currentID] = new Connection(conn, currentID);

  conn.write( JSON.stringify( {samsaaraID: currentID} ));
  conn.write( JSON.stringify( {samsaaraToken: connections[currentID].token} ));

  samsaara.addToGroup(currentID, "everyone");

  //REDIS ADD
  if(config.options.redisStore){
    samsaara.comStore.newConnection(currentID);
  }

  conn.on('close', function (message){
    removeConnection(this.id, message);
  });

  conn.on('data', function (message){
    router(connections[this.id], message);
  });
};


function router(whichOne, message){

  // Raw Messages
  // H (heartBeat)

  // JSON Pre-examination (before spending effort parsing)... 3rd character of JSON messages
  // C (callBack) ["C", "connectionToken", "callBackID", [arg1, arg2], "owner"]
  // F (function) ["F", "connectionToken", "functionName", [arg1, arg2], "callBackID"]
  // N (function in a reserved namespace) ["N", "connectionToken", "nameSpaceName", "functionName", [arg1, arg2], "callBackID"]
  // D (forced Direct Function Call) ["D", "connectionToken", "functionName", [arg1, arg2], "callBackID"]
  // P (publish/broadcast) Used to send messages to a specified channel that connections can subscribe to (not yet part of samsaara)

  // Operational (process-to-process communication), NEEDS TO BE ANOTHER FUNCTION
  // S (symbolic forward to native connection) ??
  // O (operational) ??

  if(message === 'H'){
    console.log("Heartbeat...", whichOne.id);
    whichOne.lastHeartBeat = new Date().getTime();
  }
  else{

    var designation = message.charAt(2);

    switch(designation){
      case "D":
        parseAndReceiveSub();
        break;

      default:
        if(whichOne.foreignContext !== null){
          var msgMod = '{"nativeID":"' + whichOne.id + '","contextMessage":' + message + '}';
          samsaara.redisPub.publish("CTX:" + whichOne.foreignContext, msgMod);
        }
        else{
          parseAndReceive();
        }
    }
  }

  // console.log(message);

  function parseAndReceive(){
    // try{
      var parsedMessage = JSON.parse(message);
      communication.receiveMsg.call( whichOne, parsedMessage );
    // }
    // catch(e){
    //   log.error("MESSAGE ERROR: INVALID JSON", message, e);
    // }
  }

  function parseAndReceiveSub(){
    try{
      var parsedMessage = JSON.parse(message);
      communication.receiveMsg.call( whichOne, parsedMessage[1] );
    }
    catch(e){
      log.error("MESSAGE ERROR: INVALID JSON", message, e);
    }
  }
}


var removeConnection = ConnectionController.prototype.removeConnection = function(connID, message, callBack){

  var conn = connections[connID];
  var connContext = conn.context;
  var samsaaraGroups = samsaara.groups;
  
  log.warn(" ", process.pid, moduleName, "CLOSING: ", connID);  

  //REDIS DELETE
  if(config.options.redisStore){
    samsaara.comStore.closeConnection(connID);
  }

  authentication.removeConnectionSession(connID);

  if(connContext !== null && samsaara.contexts[connContext] !== undefined){
    samsaara.contexts[connContext].removeConnection(connID);
  }

  for(var key in samsaaraGroups){
    if(samsaaraGroups[key][connID] !== undefined){
      delete samsaaraGroups[key][connID];
    }
  }

  samsaara.emit("disconnect", conn);

  connections[connID] = null;
  delete connections[connID];  
};

//CONNECTION FUNCTIONS////////////////////////////////////////////////////////////////////////////
ConnectionController.prototype.initializeConnection = function (connID, opts){

  var whichOne = connections[connID];
  var ia = whichOne.initializeAttributes;
  ia.navInfo = false;

  if(opts !== undefined){

    if(opts.groups !== undefined){
      ia.groups = false;
      samsaara.addToGroup(whichOne.id, opts.groups, function(addedGroups){
        doneInitializeConnection(connID, "groups");
      });
    }

    if(opts.timeOffset !== undefined){
      if(opts.timeOffset === "force") ia.timeOffset = false;
      testTime(connID);
    }
      
    if(opts.geoLocation !== undefined){
      if(opts.geoLocation === "force") ia.geoLocation = false;
      communication.sendTo(connID, {func: "getGeoLocation"}, geoPosition);        
    }

    if(opts.windowSize !== undefined){
      if(opts.windowSize === "force") ia.windowSize = false;
      communication.sendTo(connID, {func: "getWindowSize"}, windowResize);
    }
  }

  communication.sendTo(connID, {func: "getNavInfo"}, getNavInfo); 
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

  log.debug(process.pid, moduleName, ia);

  if(ia[whatInitialized] !== undefined){
    ia[whatInitialized] = true;
  }

  log.debug(process.pid, moduleName, whatInitialized, "INITIALIZED");

  // once timing, navInfo and groups have been taken care of, emit the initialized event on both client and server.
  // if( connections[connID].initializedItems["timing"] && connections[connID].initializedItems["navInfo"] && connections[connID].initializedItems["groups"] ){

  if(allInitialized(ia)){
    if(whichOne.initialized === false){
      communication.sendTo(connID, {func: "samsaaraInitialized", args: [connID]}, function(conn){
        connections[conn].initialized = true;
        samsaara.emit('initialized', connections[conn]);
      });
    }
  }
};


//CONNECTION's INFO FUNCTIONS
var testTime = ConnectionController.prototype.testTime = function (connID){
  var currentTime = new Date().getTime();
  if(connections[connID].navInfo.connectionTimings.afterMin < 10000000000){
    communication.sendTo(connID, {func: "testTime", args:[( connections[connID].navInfo.connectionTimings.afterMin ), currentTime]}, testTimeReturn);
  }
  else{
    communication.sendTo(connID, {func: "testTime", args:[0, currentTime]},  testTimeReturn);
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

  console.log(" ", process.pid, moduleName, this.id, "original:", originalTime, "client:", clientTime, "error:", timeError, "measurableDiff:", measurableDifference, "latency:", latency);

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
    console.log(this.id, "Time Offset:", this.navInfo.connectionTimings.clientOffset);

    this.navInfo.timeOffset = this.navInfo.connectionTimings.clientOffset;
    communication.sendTo(this.id, {func: "updateOffset", args: [this.navInfo.connectionTimings.clientOffset]});
    doneInitializeConnection(this.id, "timeOffset");
  }



  // var currentTime = new Date().getTime();
  // var latency = currentTime - originalTime;
  // var measurableDifference = currentTime - clientTime;

  // console.log(" ", process.pid, moduleName, this.id, "original:", originalTime, "client:", clientTime, "error:", timeError, "measurableDiff:", measurableDifference, "latency:", latency);

  // var connectionTimings = this.navInfo.connectionTimings;  
  // var latencies = connectionTimings.latencies;
  // var clientOffsetGuesses = connectionTimings.clientOffsetGuesses;
  // var measurableDifferences = connectionTimings.measurableDifferences;

  // console.log(measurableDifferences);


  // var clientOffset = connectionTimings.clientOffset;
  // var afterMin = connectionTimings.afterMin;

  // if(latencies.length > timeAccuracy){
  //   latencies.shift();
  //   measurableDifferences.shift();
  //   clientOffsetGuesses.shift();
  // }

  // latencies.push(latency);  
  // measurableDifferences.push(measurableDifference);

  // var currenAfterMin = helper.min(measurableDifferences);
  // if (currenAfterMin < afterMin){
  //   afterMin = currenAfterMin;
  // }

  // var lagBehind = latency - timeError;
  // if(latencies.length > 2){
  //   clientOffsetGuesses.push( measurableDifference - lagBehind );
  // }

  // clientOffset = helper.median(clientOffsetGuesses);
  // console.log(" ", process.pid, moduleName, this.id, "OffsetGuesses:", lagBehind, measurableDifference, latency, timeError);

  // if(latencies.length < timeAccuracy){
  //   testTime(this.id);
  // }
  // else{    
  //   log.info(" ", process.pid, moduleName, this.id, "Time Offset:", clientOffset);

  //   this.navInfo.timeOffset = clientOffset;
  //   communication.sendTo(this.id, {func: "updateOffset", args: [clientOffset]});
  //   doneInitializeConnection(this.id, "timeOffset");
  // }
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
    samsaara.emit('windowSize', this, width, height, windowOffsetX, windowOffsetY);
  }
  else{
    samsaara.emit('windowSize', this, width, height);
  }
};


var geoPosition = ConnectionController.prototype.geoPosition = function (geoposition){
  //this is the connection that returns the message
  this.navInfo.geoposition = geoposition;
  doneInitializeConnection(this.id, "geoLocation");
  samsaara.emit('geoPosition', this, geoposition);
};


var updateConnectionInfo = ConnectionController.prototype.updateConnectionInfo = function (attributes, callBack){

  var whichOne = this;
  log.debug(process.pid, moduleName, "UPDATING CONNECTION INFO", attributes, whichOne);

  for(var attr in attributes){
    whichOne[attr] = attributes[attr];
  }
  if(whichOne.connectionClass === "symbolic"){
    samsaara.comStore.sendToOwner(whichOne.id, whichOne.owner, {func: "updateConnectionInfo", args: [attributes], specialKey: samsaara.specialKey}, callBack);
  }
};

