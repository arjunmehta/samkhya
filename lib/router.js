/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var path = require("path");
var moduleName = path.basename(module.filename);

var helper = require('./helper.js');
var log = require("./log.js");

var router = {};

exports = module.exports = router;

router = (function router(module){

  var config = require('./config');
  var communication = require('./communication');

  var preRouteFilters = module.preRouteFilters = [];

  /*
   * Message Handling
   *
   * Messages are handled in fairly linear progression.
   *
   * 1. handleMessage - Very low level handling of messages, without parsing. (ie. determine if message is just a heartbeat).
   * 2. preRouteFilterPrepend - filter raw message contents before routing and append additional data to the raw message. (good place for low level authentication)
   * 3. routeMessage - determine where the raw message is going. Either Local, or to Another Process.
   * 
   * Local message
   * 1. processMessage - usually where message is parsed to JSON.
   * 2. executeFunction - direct messages after they've been parsed/serialized to a samsaara method.
   *
   * IPC Message handled in IPC module
   * 1. processMessage - message parsed to JSON. Analyze message prepend
   * 2. 
   */


  module.newConnectionMessage = function(connection, message){

    console.log("New Connection Message", connection.id, message);
    
    // This is quite the process to happen for each message. Is that okay?
    // messages come in the format ownerID:ITM:Itemcontent:ANTH:AnotherItemContent::{JSONString}
    // it's much more efficient to have a look at the beginning of a string than to parse an entire JSON string for preprocessing.
    // yet of course not as efficient as just taking in a raw string.

    var splitIndex = message.indexOf("::");
    var messageAttributes = message.substr(0, splitIndex).split(":");
    var owner = messageAttributes[0];
    var newPrepend = "";
    message = message.slice(2+splitIndex-message.length);
   
    var i = 0;
    next();

    function next(err){
      if(err){
        console.log("Message Acceptance Error:", err);
      }
      else if(preRouteFilters > i++){
        preRouteFilters[i](connection, messageAttributes, newPrepend, next);
      }   
      else{        
        module.routeMessage(connection, owner, newPrepend, message);
      }
    }
  };


  module.routeMessage = function(connection, owner, newPrepend, message){
    // must pass json parseable message to processMessage or if it's not JSON parseable, pass on to something else.
    module.processMessage(connection, message);
  };


  module.processMessage = function(connection, message){

    var parsedMessage;    

    try{
       parsedMessage = JSON.parse(message);    
    }
    catch(e){
      log.error("MESSAGE ERROR: INVALID JSON", message, e);
    }

    if(parsedMessage !== undefined){
      module.receiveMessageObject(connection, parsedMessage);
    }

  };


  module.receiveMessageObject = function (connection, messageObj){

    messageObj.sender = connection.id;

    if(messageObj.func !== undefined){
      communication.executeFunction(connection, messageObj);
    }
    else if(messageObj.opts !== undefined){
      log.info(process.pid, moduleName, messageObj.opts);
      connection.initialize(messageObj.opts);
    }
  };


})(router);

