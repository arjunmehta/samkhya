/*!
 * Samsaara - Connection Initialization Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:connections');


var connectionController = {};


function initialize(samsaaraCore){


  (function connectionController(module){

    var samsaara = samsaaraCore.samsaara;
    var processUuid = samsaaraCore.uuid;

    var heartBeatThreshold = module.heartBeatThreshold = 11000; 
    module.globalBeat = 0;

    var Connection = module.Connection = require('../models/connection').Connection;
    var connections = module.connections = {};

    module.connection = connection;
    
    function connection(connID){
      return connections[connID];
    }

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
        // debug(processUuid, new Date().toTimeString(), "CONNECTION Alive:", connection.id, connection.connectionClass);
        if(connection.owner === processUuid && connection.lastHeartBeat < currentTimeOutTime){
          connection.conn.close(111, "Flatlining Connection");
        }
      }
    }

    function updateGlobalBeat(){
      module.globalBeat++;
    }


    /**
     * Creates and sets up a new connection, and all associated with it.
     */

    module.createNewConnection = function(connection){
      var newConnection = new Connection(connection);
      connections[newConnection.id] = newConnection;
    };

  })(connectionController);


  return connectionController;

}



exports = module.exports = {
  initialize: initialize
};



