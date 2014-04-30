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

var config = require('../lib/config');
var authentication = require('../lib/authentication');
var communication = require('../lib/communication');
var grouping = require('../lib/grouping');

var connections = require('../lib/connectionController').connections;
var router = require('../lib/communication').router;
var contexts = require('../lib/contextController').contexts;
var groups = grouping.groups;


var timeAccuracy = 7;
// var moduleExtensions = require('../lib/extension');

// for(var Extension in moduleExtensions.Connection){
//   util.inherits(Connection, moduleExtensions.Connection[Extension]);
// }


exports = module.exports = Connection;


function Connection(conn){

  var currentID = conn.id;
  var connection = this;

  this.id = currentID;
  this.conn = conn;

  this.userID = 'anonymous' + helper.makeIdAlphaNumerical(5);
  this.key = helper.makeIdAlphaNumerical(20) + currentID;

  this.token = helper.makeUniqueHash('sha1', this.key, [this.userID]);

  this.connectionClass = "native";

  this.initialized = false;
  this.initializeAttributes = new InitializedAttributes(this);

  this.lastHeartBeat = new Date().getTime();

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

  // Events  

  conn.on('close', function (message){
    connection.closeConnection(message);
  });

  conn.on('data', function (message){
    router(connections[connection.id], message);
  });

  conn.write(JSON.stringify([config.uuid,{
    samsaaraID: currentID, 
    samsaaraToken: connection.token, 
    samsaaraOwner: config.uuid
  }]));

  config.emit("connect", this);

  if(config.redisStore === true){
    this.subscribeRedis();
  }

}



// var extensionFunctions = {
//   connect: {
//     grouping: function(samsaaraConnection){
//       grouping.addSamsaaraConnection(samsaaraConnection);
//     }
//   },
//   close: {

//   }  
// };


Connection.prototype.initialize = function(opts){

  console.log("TRYING TO INITIALIZE CONNECTION", this.id);

  var connection = this;
  var ia = this.initializeAttributes;
  
  if(opts !== undefined){
    for(var extension in initializationMethods){
      initializationMethods[extension](opts, connection, ia);
    }
  }
  else{
    this.completeInitialization();
  }  
};

Connection.prototype.completeInitialization = function(){
  if(this.initialized === false){
    communication.sendToClient(this.id, {internal: "samsaaraInitialized", args: [true]}, function (confirmation){
      this.initialized = true;
      config.emit('initialized', this);
    });
  }
};

Connection.prototype.closeConnection = function(message){
  // var hd = new memwatch.HeapDiff();
  ////////

  var connID = this.id;
  var connContext = this.context;
  
  config.emit("disconnect", this);

  authentication.removeConnectionSession(connID);

  if(connContext !== null && contexts[connContext] !== undefined){
    contexts[connContext].removeConnection(connID);
  }

  for(var key in groups){
    if(groups[key][connID] !== undefined){
      delete groups[key][connID];
    }
  }

  this.conn.removeAllListeners();
  delete connections[connID];

  if(config.redisStore === true){
    this.unsubscribeRedis();
  }

  log.warn(" ", config.uuid, moduleName, "CLOSING: ", connID, message);

  ////////
  // var diff = hd.end();
  // console.log(diff.change.details);
};






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



/**
 * Redis Specific Methods for new and closing connections
 */

Connection.prototype.subscribeRedis = function(){
  config.redisSub.subscribe("NTV:"+this.id);
  config.redisClient.incr("totalCurrentCount");
};

Connection.prototype.unsubscribeRedis = function (){

  config.redisSub.unsubscribe("NTV:"+this.id);
  config.redisClient.decr("totalCurrentCount");
  var foreignContext = this.foreignContext;

  if(foreignContext !== null){
    log.info(process.pid, moduleName, "CTX: Closing Connection Request", foreignContext);
    config.redisPub.publish("CTX:"+foreignContext, JSON.stringify( {disconnect: this.id}) );
  }
};


// Connection.prototype.receive = function(messageObj){

//   var tokenMatch = (this.token === messageObj.token) || (this.oldToken === messageObj.token);

//   if(messageObj.opts){
//     log.info(process.pid, moduleName, messageObj.opts);
//     connectionController.initializeConnection(this.id, messageObj.opts);
//   }

//   if(messageObj.login){
//     this.loginConnection(messageObj);
//   }

//   if(messageObj.func){    
//     if(tokenMatch){
//       this.executeFunction(messageObj);
//     }
//     else{
//       log.info(process.pid, moduleName, process.pid, "ERROR: Token Mismatch:", this.token, messageObj.token);
//     }
//   }
// };


function InitializedAttributes(connection){
  this.connection = connection;
  this.forced = {};
}

InitializedAttributes.prototype.force = function(attribute){
  this.forced[attribute] = false;
  // console.log("////////////////////////////////Forcing Attribute", this.forced);
};

InitializedAttributes.prototype.initialized = function(err, attribute){

  // console.log("////////////////////////////////InitializedAttributes", attribute, this.forced);

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
  groups: groupingInitOptions,
  timeOffset: timeOffsetInitOptions,
  geoLocation: geoLocationInitOptions,
  windowSize: windowSizeInitOptions
};

function navInfoInitOptions(opts, connection, attributes){

  console.log("Initializing NavInfo...");
  attributes.force("navInfo");
  communication.sendToClient(connection.id, {internal: "getNavInfo"}, function getNavInfo(navInfo){

    var connNavInfo = this.navInfo;
    for(var key in navInfo){
      connNavInfo[key] = navInfo[key];
    }

    connNavInfo.remoteAddress = this.remoteAddress;
    connNavInfo.protocol = this.protocol;

    attributes.initialized(null, "navInfo");
  });

}

function groupingInitOptions(opts, connection, attributes){
  if(opts.groups !== undefined){
    console.log("Initializing Grouping...", opts.groups, connection.id);
    attributes.force("grouping");
    opts.groups.push('everyone');
    grouping.addToGroup(connection.id, opts.groups, function (addedGroups){
      attributes.initialized(null, "grouping");
    });
  }
}

function timeOffsetInitOptions(opts, connection, attributes){
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
  if(connections[connID].navInfo.connectionTimings.afterMin < 10000000000){
    communication.sendToClient(connID, {internal: "testTime", args:[( connections[connID].navInfo.connectionTimings.afterMin ), currentTime]}, testTimeReturn);
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

  if(this.navInfo.connectionTimings.latencies.length > timeAccuracy){
    this.navInfo.connectionTimings.latencies.shift();
    this.navInfo.connectionTimings.measurableDifferences.shift();
    this.navInfo.connectionTimings.clientOffsetGuesses.shift();
  }

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
    this.initializeAttributes.initialized(null, "timeOffset");
  }

}





function windowResize(width, height, windowOffsetX, windowOffsetY){
  //this is the connection that returns the message

  this.navInfo.windowWidth = width;
  this.navInfo.windowHeight = height;

  if(windowOffsetX){
    config.emit('windowSize', this, width, height, windowOffsetX, windowOffsetY);
  }
  else{
    config.emit('windowSize', this, width, height);
  }
}


function geoPosition(err, geoposition){
  //this is the connection that returns the message
  if(this.navInfo !== undefined){
    this.navInfo.geoposition = geoposition;
    this.initializeAttributes.initialized(err, "geoLocation");
    config.emit('geoPosition', this, err, geoposition);
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

