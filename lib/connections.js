/*!
 * Samsaara - Connection Initialization Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:connections');


var core, 
    samsaara;

var heartbeats = require('heartbeats');
var heart, 
    heartBeatThreshold;
var clearConnectionsInterval;


var connectionController = {};
var connections = connectionController.connections = {};
var Connection;


function initialize(samsaaraCore){

  core = samsaaraCore;
  samsaara = samsaaraCore.samsaara;

  heartBeatThreshold = connectionController.heartBeatThreshold = 11000;
  heart = heartbeats.createHeart(heartBeatThreshold, 'global');

  Connection = connectionController.Connection = require('../models/connection').Connection;

  clearConnectionsInterval = setInterval(checkForDeadConnections, heartBeatThreshold*2.5);

  return connectionController;
}


// retrieves and returns the connection at the connection ID.   

var connection = connectionController.connection = function(connID){
  return connections[connID];
};


// creates and sets up a new connection, and all associated with it.   

connectionController.createNewConnection = function(connection){
  var newConnection = new Connection(connection);
  connections[newConnection.id] = newConnection;
};


// efficient Heartbeats timeout check.

function checkForDeadConnections(){

  var threshold = Math.floor(25000/10000);
  var connection;

  for(var connID in connections){    
    connection = connections[connID];    
    if(connection.owner === core.uuid && connection.pulse.missedBeats() > threshold){
      connection.conn.close(111, "Flatlining Connection");
    }
  }
}


exports = module.exports = {
  initialize: initialize
};