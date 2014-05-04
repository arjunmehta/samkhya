/*!
 * Samsaara - Connection Initialization Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var path = require('path');
var moduleName = path.basename(module.filename);

var memwatch = require('memwatch');

var helper = require('./helper.js');
var log = require('./log.js');

var connectionController = {};

exports = module.exports = connectionController;


/**
 * Module "Constructor".
 */

connectionController = (function connectionController(module){

  var config = require('./config.js');

  var connections = module.connections = {};

  var Connection = module.Connection = require('../models/connection.js');

  var heartBeatThreshold = 11000;

  /**
   * Efficient Heartbeats
   */

  module.globalBeat = 0;

  var clearConnectionsInterval = setInterval(checkForDeadConnections, heartBeatThreshold*2.5);
  var updateGlobalBeatInterval = setInterval(updateGlobalBeat, heartBeatThreshold);

  function checkForDeadConnections(){

    var currentTimeOutTime = module.globalBeat - Math.floor(25000/10000);
    var connection;

    for(var connID in connections){
      connection = connections[connID];
      // console.log(""+process.pid, new Date().toTimeString(), "CONNECTION Alive:", connection.id, connection.connectionClass);
      if(connection.connectionClass === "native" && connection.lastHeartBeat < currentTimeOutTime){
        connection.conn.close(111, "Flatlining Connection");
      }
    }
  }

  function updateGlobalBeat(){
    module.globalBeat++;
  }


  module.setOptions = function(options){

  };


  /**
   * Creates and sets up a new connection, and all associated with it.
   */

  module.createNewConnection = function(connection){
    var newConnection = new Connection(connection);
    connections[newConnection.id] = newConnection;
  };

})(connectionController);




