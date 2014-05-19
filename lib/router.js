/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var debug = require('debug')('samsaara:router');
var debugError = require('debug')('samsaara:router:error');

var router = {};

exports = module.exports = router;

router = (function router(module){

  var config = require('./config');
  var communication = require('./communication');

  var preRouteFilters = module.preRouteFilters = [];

  // Message Handling
  // 
  // Messages are handled in fairly linear progression and gated at each step.
  // 
  // 1. handle new message - Very low level handling of messages, without parsing. (ie. determine if message is just a heartbeat).
  // 2. preRouteFilterPrepend - filter raw message contents before routing and append additional data to the raw message. (good place for low level authentication)
  // 3. routeMessage - determine where the raw message is going. Either Local, or to Another Process.
  // 
  // Local message
  // 1. processMessage - usually where message is parsed to JSON.
  // 2. executeFunction - direct messages after they've been parsed/serialized to a samsaara method.
  // 
  // IPC Message handled in IPC module sent to another process
  // 1. processMessage - message parsed to JSON. Analyze message prepend
  // 2. executeFunction locally - but connection info might not be available


  module.newConnectionMessage = function(connection, message){

    debug("New Connection Message", connection.id, message);

    
    // This is quite the process to happen for each message. Is that okay?
    // messages come in the format ownerID:ITM:Itemcontent:ANTH:AnotherItemContent::{JSONString}
    // it's much more efficient to have a look at the beginning of a string than to parse an entire JSON string for preprocessing.
    //
    // This allows the message to be routed somewhere else if the middleware wants that.
     

    var splitIndex = message.indexOf("::");
    var headerAttributes = message.substr(0, splitIndex).split(":");
    var owner = headerAttributes[0];
    var newHeader = "";
    message = message.slice(2+splitIndex-message.length);

    var i = 0;
    next();

    function next(err){
      if(err){
        debugError("Message Acceptance Error:", err);
      }
      else if(preRouteFilters.length > i){
        preRouteFilters[i++](connection, owner, headerAttributes, newHeader, message, next);
      }
      else{
        module.routeMessage(connection, owner, newHeader, message);
      }
    }

  };



  // 
  // This method may be overwritten by other modules that handle the routing of messages to different owners (ie. ipc)
  //

  module.routeMessage = function(connection, owner, newHeader, message){
    module.processMessage(connection, message);
  };


  module.processMessage = function(connection, message){

    var parsedMessage = parseJSON(message);

    if(parsedMessage !== undefined){
      module.receiveMessageObject(connection, parsedMessage);
    }

  };


  module.receiveMessageObject = function (connection, messageObj){

    messageObj.sender = connection.id;

    if(messageObj.func !== undefined){
      communication.executeFunction({connection: connection}, messageObj);
    }
    else if(messageObj.opts !== undefined){
      debug("Connection Options", messageObj.opts);
      connection.initialize(messageObj.opts);
    }
  };


})(router);

function parseJSON(jsonString){
  var parsed;

  try{
    parsed = JSON.parse(jsonString);      
  }
  catch(e){
    debug("Message Error: Invalid JSON", jsonString, e);
  }

  return parsed;
}

