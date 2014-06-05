/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var debug = require('debug')('samsaara:router');
var debugError = require('debug')('samsaara:router:error');


var core,
    samsaara;

var router = {};

var communication;
var preRouteFilters;
var messageRoutes;


function initialize(samsaaraCore){

  core = samsaaraCore;
  samsaara = samsaaraCore.samsaara;

  communication = samsaaraCore.communication;

  preRouteFilters = router.preRouteFilters = [];

  messageRoutes = router.messageRoutes = {
    OWN: localExecutionRoute,
    INIT: initializeRoute
  };

  return router;
}




// Message Handling
// 
// Messages are handled in fairly linear progression and gated at each step.
// 
// 1. handle new message - Very low level handling of messages, without parsing. (ie. determine if message is just a heartbeat). Happens in the Connection object. (ref)
// 2. handle message from connection (newConnectionMessage) - Separated out the header from the message and parses(splits) the header into an array of values.
// 2. process preRouteFilters - filter messages based certain middleware specified values before getting it to the router (good place for low level authentication)
// 3. route Message (route) - Based on the first value of the header, determine where the raw message is going, by finding the route in messageRoutes.


// Messages come in the format ROUTEKEY:routeValue:KEYA:ValueA:KEYB:ValueB::{JSONString}
// it's much more efficient to have a look at the beginning of a string than to parse an entire JSON string for preprocessing.
//
// This allows the message to be routed somewhere else if the middleware wants that.

router.newConnectionMessage = function(connection, message){

  debug("New Connection Message", connection.id, message);

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
      route(connection, headerbits, message);
    }
  }
};


// compare the first value in the header to what might exist in the messageRoutes object.

var route = router.route = function(connection, headerbits, message){      
  if(messageRoutes[headerbits[0]]){
    messageRoutes[headerbits[0]](connection, headerbits, message);
  }
};


// core routes
// INIT: Initialization Route

function initializeRoute(connection, headerbits, message){
  var messageObj = parseJSON(message);

  if(messageObj !== undefined && messageObj.opts !== undefined){
    debug("Connection Options", messageObj.opts);
    connection.initialize(messageObj.opts);
  }
}

// OWN: Owner Route

function localExecutionRoute(connection, headerbits, message){
  var messageObj = parseJSON(message);

  if(messageObj !== undefined && messageObj.func !== undefined){
    messageObj.sender = connection.id;
    communication.executeFunction(connection, connection, messageObj);
  }
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

