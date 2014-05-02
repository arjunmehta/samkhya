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

connectionController = (function ConnectionController(module){

  var samsaara = require("../index.js");
  var config = require('./config.js');

  var connections = module.connections = {};

  var Connection = module.Connection = require('../models/connection.js');
  // console.log("The Connection Model", module.Connection);

  setInterval(checkForDeadConnections, 25000);

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

  module.createNewConnection = function(connection){
    var newConnection = new Connection(connection);
    connections[newConnection.id] = newConnection;
  };

})(connectionController);




