/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var debug = require('debug')('samsaara:router');
var debugError = require('debug')('samsaara:router:error');


var router = {};


function initialize(samsaaraCore){


  (function router(module){


    var communication = samsaaraCore.communication;

    var preRouteFilters = module.preRouteFilters = [];

    var messageRoutes = module.messageRoutes = {
      OWN: localExecutionRoute,
      INIT: initializeRoute
    };


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
      var headerbits = message.substr(0, splitIndex).split(":");

      message = message.slice(2+splitIndex-message.length);

      var i = 0;
      next();

      function next(err){
        if(err !== undefined){
          debugError("Message Acceptance Error:", err);
        }
        else if(preRouteFilters.length > i){
          preRouteFilters[i++](connection, headerbits, message, next);
        }
        else{
          module.route(connection, headerbits, message);
        }
      }
    };



    // 
    // This method may be overwritten by other modules that handle the routing of messages to different owners (ie. ipc)
    //


    module.route = function(connection, headerbits, message){      
      if(messageRoutes[headerbits[0]]){
        messageRoutes[headerbits[0]](connection, headerbits, message);
      }      
    };


    function initializeRoute(connection, headerbits, message){
      var messageObj = parseJSON(message);

      if(messageObj !== undefined && messageObj.opts !== undefined){
        debug("Connection Options", messageObj.opts);
        connection.initialize(messageObj.opts);
      }
    }

    function localExecutionRoute(connection, headerbits, message){
      var messageObj = parseJSON(message);

      if(messageObj !== undefined && messageObj.func !== undefined){
        messageObj.sender = connection.id;
        communication.executeFunction({connection: connection}, messageObj);
      }
    }


  })(router);


  return router;

}


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



exports = module.exports = {
  initialize: initialize
};

