/*!
 * Samsaara - Connection Initialization Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:connections');

var heartbeats = require('heartbeats');


var connectionController = {};


function initialize(samsaaraCore){


  (function connectionController(module){


    var samsaara = samsaaraCore.samsaara;

    var heartBeatThreshold = module.heartBeatThreshold = 11000;
    var heart = heartbeats.createHeart(heartBeatThreshold, 'global');

    var Connection = module.Connection = require('../models/connection').Connection;
    var connections = module.connections = {};

    module.connection = connection;
    
    function connection(connID){
      return connections[connID];
    }


    // 
    // Efficient Heartbeats
    //   

    var clearConnectionsInterval = setInterval(checkForDeadConnections, heartBeatThreshold*2.5);

    function checkForDeadConnections(){

      var threshold = Math.floor(25000/10000);
      var connection;

      for(var connID in connections){
        connection = connections[connID];
        if(connection.owner === samsaaraCore.uuid && connection.pulse.missedBeats() > threshold){
          connection.conn.close(111, "Flatlining Connection");
        }
      }
    }

    // Creates and sets up a new connection, and all associated with it.   

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



