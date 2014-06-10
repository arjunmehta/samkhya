/*!
 * samsaaraSocks - Connection Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

// var memwatch = require('memwatch');

var debug = require('debug')('samsaara:connection:main');
var debugInitialization = require('debug')('samsaara:connection:initialization');
var debugCommunication = require('debug')('samsaara:connection:communication');
var debugHeartbeat = require('debug')('samsaara:connection:heartbeat');

var heartbeats = require('heartbeats');

var core,
    samsaara,
    communication,
    connectionController,
    router,
    connections;

var preInitializationMethods = [],
    initializationMethods = [],
    closingMethods = [];


function initialize(samsaaraCore){

  core = samsaaraCore;
  samsaara = samsaaraCore.samsaara;
  communication = samsaaraCore.communication;
  connectionController = samsaaraCore.connectionController;
  router = samsaaraCore.router;
  
  connections = connectionController.connections;

  return Connection;
}


function Connection(conn){

  var connection = this;

  this.id = conn.id;
  this.conn = conn;

  this.owner = core.uuid;

  this.initializeAttributes = new InitializedAttributes(this);
  this.initialized = false;

  this.pulse = heartbeats.heart("global").newPulse();

  this.connectionData = {};

  for(var i=0; i < preInitializationMethods.length; i++){
    preInitializationMethods[i](connection);
  }

  conn.on('close', function (message){
    connection.closeConnection(message);
  });

  conn.on('data', function (message){
    connection.handleMessage(message);
  });

  conn.write(JSON.stringify(["init",{
    samsaaraID: connection.id,
    samsaaraOwner: core.uuid,
    samsaaraHeartBeat: connectionController.heartBeatThreshold
  }]));

  samsaara.emit("connectionConnected", this);
}



// Method to update connectionData attribute on the connection. This method should be used when updating
// the connection with new data, as it can be middlewared to broadcast changes, etc.

Connection.prototype.updateDataAttribute = function(attributeName, value) {
  this.connectionData[attributeName] = value;
};


// Method to handle new socket messages.

Connection.prototype.handleMessage = function(raw_message){

  debugCommunication("New Connection Message on "+ core.uuid, this.id, raw_message);

  this.pulse.beat();

  switch(raw_message){
    case "H":
      debugHeartbeat("Heartbeat...", this.id, this.pulse.present, this.pulse.heart.present);
      break;
    default:
      router.newConnectionMessage(this, raw_message);
  }
};



// creates a namespace object that holds an execute method with the namespace as a closure..

Connection.prototype.nameSpace = function(nameSpaceName){

  var connection = this;

  return {
    execute: function execute(){
      var packet = {ns:nameSpaceName, func: arguments[0], args: []};
      executeOnConnection(connection, packet, arguments);
    }
  };
};


// Method to execute methods on the client.

Connection.prototype.execute = function(){

  var connection = this;
  var packet = {func: arguments[0], args: []};
  executeOnConnection(connection, packet, arguments);
};


function executeOnConnection(connection, packet, args){

  communication.processPacket(0, packet, args, function (incomingCallBack, packetReady){
    if(incomingCallBack !== null){
      incomingCallBack.addConnection(connection.id);
    }
    connection.write(packetReady); // will send directly or via symbolic
  });
}

// Method to execute methods on the client.

Connection.prototype.executeRaw = function(packet, callback){

  var connection = this;

  if(typeof callback === "function"){
    communication.makeCallBack(0, packet, callback, function (incomingCallBack, packetReady){
      incomingCallBack.addConnection(connection.id);
      connection.write(packetReady); // will send directly or via symbolic
    });
  }
  else{
    var sendString;
    try{
      sendString = JSON.stringify([core.uuid, packet]);
    }
    catch(e){
      console.log("ERROR SENDING PACKET", core.uuid, packet);
    }

    connection.write( sendString );
  }

};


function processPacket(packet, args){

  for (var i = 1; i < args.length-1; i++){
    packet.args.push(args[i]);
  }

  if(typeof args[args.length-1] === "function"){
    packet = core.makeCallBack(packet, args[args.length-1]);
  }
  else{
    packet.args.push(args[args.length-1]);
  }

  return packet;
}


// Method to send new socket messages.

Connection.prototype.write = function(message){
  // debugCommunication(core.uuid, "NATIVE write on", this.id);
  this.conn.write(message);
};


// Connection close handler.

Connection.prototype.closeConnection = function(message){

  var connID = this.id;
  samsaara.emit("connectionDisconnected", this);

  for(var i=0; i < closingMethods.length; i++){
    closingMethods[i](this);
  }

  this.conn.removeAllListeners();

  delete connections[connID];

  // debug(core.uuid, "CLOSING:", connID, message);
};


// Method to start the initialization process. Executed from the router, when the opts message is received.

Connection.prototype.initialize = function(opts){

  debugInitialization("Trying To Initialize Connection...", this.id);

  opts = opts || {};

  var connection = this;
  var ia = this.initializeAttributes;

  if(initializationMethods.length > 0){
    for(var i=0; i < initializationMethods.length; i++){
      initializationMethods[i](opts, connection, ia);
    }    
  }
  else{
    this.completeInitialization();
  }
  
  ia.ready = true;

};


// Method to finish the initialization process.

Connection.prototype.completeInitialization = function(){
  if(this.initialized === false){
    this.initialized = true;

    debugInitialization(core.uuid, this.id, "Initialized");

    this.executeRaw({ns:"internal", func:"samsaaraInitialized", args: [true]}, function (confirmation){
      samsaara.emit('connectionInitialized', this);
    });
  }
};



// A special object that manages the initialization of various attributes of the connection.

function InitializedAttributes(connection){
  this.connection = connection;
  this.forced = {};
  this.count = 0;
  this.ready = false;
}

InitializedAttributes.prototype.force = function(attribute){
  this.forced[attribute] = false;
};

InitializedAttributes.prototype.initialized = function(err, attribute){

  debugInitialization("...Initialized attribute", attribute, this.forced);

  if(err) debugInitialization(err);

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
      if (forced[attr] === false) return false;
    }
  }
  return true;
};



exports = module.exports = {

  initialize: initialize,

  preInitializationMethods : preInitializationMethods,
  initializationMethods : initializationMethods,
  closingMethods : closingMethods,

  Connection: Connection,
  InitializedAttributes: InitializedAttributes
};
