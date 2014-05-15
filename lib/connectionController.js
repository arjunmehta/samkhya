/*!
 * Samsaara - Connection Initialization Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:connections');
var memwatch = require('memwatch');

var connectionController = {};

exports = module.exports = connectionController;


/**
 * Module "Constructor".
 */

connectionController = (function connectionController(module){

  var config = require('./config.js');
  var samsaaraConnection = require('../models/connection');

  debug("samsaaraConnection", samsaaraConnection, config);

  var Connection = module.Connection = samsaaraConnection.Connection;

  var connections = module.connections = {};

  var heartBeatThreshold = module.heartBeatThreshold = 11000;

  module.globalBeat = 0;

  /**
   * Efficient Heartbeats
   */  

  var clearConnectionsInterval = setInterval(checkForDeadConnections, heartBeatThreshold*2.5);
  var updateGlobalBeatInterval = setInterval(updateGlobalBeat, heartBeatThreshold);

  function checkForDeadConnections(){

    var currentTimeOutTime = module.globalBeat - Math.floor(25000/10000);
    var connection;

    for(var connID in connections){
      connection = connections[connID];
      // debug(config.uuid, new Date().toTimeString(), "CONNECTION Alive:", connection.id, connection.connectionClass);
      if(connection.owner === config.uuid && connection.lastHeartBeat < currentTimeOutTime){
        connection.conn.close(111, "Flatlining Connection");
      }
    }
  }

  function updateGlobalBeat(){
    module.globalBeat++;
  }


  module.setOptions = function(options){
    //set things like heart beat time out time... this shouldn't exist.
  };


  /**
   * Creates and sets up a new connection, and all associated with it.
   */

  module.createNewConnection = function(connection){
    var newConnection = new Connection(connection);
    connections[newConnection.id] = newConnection;
  };

})(connectionController);




