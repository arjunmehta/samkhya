/*!
 * Samsaara - Connection Initialization Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */



exports = module.exports = new ConnectionController();

var path = require('path');
var moduleName = path.basename(module.filename);

var memwatch = require('memwatch');

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

var connections;

function ConnectionController(){
  connections = this.connections = {};
  this.Connection = Connection;
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

/**
 * Creates and sets up a new connection, and all associated with it.
 */
ConnectionController.prototype.createNewConnection = function(conn){

  var newConnection = new Connection(conn);
  connections[newConnection.id] = newConnection;

};





// var removeConnection = ConnectionController.prototype.removeConnection = function(connID, message, callBack){

//   var conn = connections[connID];
//   var connContext = conn.context;
  
//   log.warn(" ", process.pid, moduleName, "CLOSING: ", connID);  

//   //REDIS DELETE
//   if(config.redisStore === true){
//     communication.closeConnection(connID);
//   }

//   authentication.removeConnectionSession(connID);

//   if(connContext !== null && contexts[connContext] !== undefined){
//     contexts[connContext].removeConnection(connID);
//   }

//   for(var key in groups){
//     if(groups[key][connID] !== undefined){
//       delete groups[key][connID];
//     }
//   }

//   config.emit("disconnect", conn);

//   // connections[connID] = null;
//   conn.conn.removeAllListeners();
//   delete connections[connID];  
// };

//CONNECTION FUNCTIONS////////////////////////////////////////////////////////////////////////////
// ConnectionController.prototype.initializeConnection = function (connID, opts){

//   console.log(""+process.pid, moduleName, connID, "//////////INITIALIZING WITH OPTIONS", opts);

//   var whichOne = connections[connID];
//   var ia = whichOne.initializeAttributes;
//   ia.navInfo = false;

//   if(opts !== undefined){

//     if(opts.groups !== undefined){
//       ia.groups = false;
//       grouping.addToGroup(whichOne.id, opts.groups, function (addedGroups){
//         doneInitializeConnection(connID, "groups");
//       });
//     }

//     if(opts.timeOffset !== undefined){
//       if(opts.timeOffset === "force") ia.timeOffset = false;
//       testTime(connID);
//     }
      
//     if(opts.geoLocation !== undefined){
//       if(opts.geoLocation === "force") ia.geoLocation = false;
//       communication.sendToClient(connID, {internal: "getGeoLocation"}, geoPosition);
//     }

//     if(opts.windowSize !== undefined){
//       if(opts.windowSize === "force") ia.windowSize = false;
//       communication.sendToClient(connID, {internal: "getWindowSize"}, windowResize);
//     }
//   }

//   communication.sendToClient(connID, {internal: "getNavInfo"}, getNavInfo); 
// };


// function allInitialized(ia){
//   for(var attr in ia){
//     if (ia[attr] === false) return false;
//   }
//   return true;
// }


// var doneInitializeConnection = ConnectionController.prototype.doneInitializeConnection = function (connID, whatInitialized){

//   var whichOne = connections[connID];
//   var ia = whichOne.initializeAttributes;

//   if(ia[whatInitialized] !== undefined){
//     ia[whatInitialized] = true;
//   }

//   console.log(""+process.pid, moduleName, connID, whatInitialized, "INITIALIZED");

//   if(allInitialized(ia)){
//     if(whichOne.initialized === false){
//       communication.sendToClient(connID, {internal: "samsaaraInitialized", args: [true]}, function (confirmation){
//         whichOne.initialized = true;
//         config.emit('initialized', whichOne);
//       });
//     }
//   }

// };




