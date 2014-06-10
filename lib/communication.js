/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:communication');
var debugExecution = require('debug')('samsaara:communication:execution');
var debugError = require('debug')('samsaara:communication:error');

var core, samsaara;
var communication = {};

var outgoingCallBacks = communication.outgoingCallBacks = {};        //outgoing callbacks are those sent from the host when it's done executing.
var incomingCallBacks = communication.incomingCallBacks = {};        //incoming callbacks are those sent from the client when it's done executing.
var callBackIDOffset = 0;
var IncomingCallBack;

var nameSpaces = {};
var NameSpace;



// initialization method

function initialize(samsaaraCore){

  core = samsaaraCore;
  samsaara = samsaaraCore.samsaara;

  IncomingCallBack = communication.IncomingCallBack = require('../models/callback.js').IncomingCallBack;
  NameSpace = communication.NameSpace = require('../models/namespace.js').NameSpace;

  createNamespace("core", {});

  createNamespace("internal", {
    callItBack: callItBack,
    callItBackError: callItBackError
  });

  return communication;
}


// Main Communication and Callback Methods

communication.writeTo = function(connection, packetReady){
  connection.write( packetReady );
};


// Public Communication Namespace Methods

communication.expose = function(set){
  nameSpace("core").expose(set);
  return samsaara;
};


// Function Execution Methods

communication.executeFunction = function(executor, context, messageObj, callBackGenerator){

  var func = messageObj.func;
  var nsName = messageObj.ns || 'core';
  var ns = nameSpace(nsName);

  if(ns !== undefined){

    ns = ns.methods;

    var messageArgs = messageObj.args || [];

    if(messageArgs[0] === "samsaara.self"){
      messageArgs[0] = executor;
    }

    callBackGenerator = callBackGenerator || createOutgoingCallBack;

    debugExecution("Executing Function", nsName, func, executor.id);

    if(typeof ns[func] === "function"){

      var callBackID = messageObj.callBack;

      if(typeof callBackID === "string" && callBackID.match(/^([a-zA-Z0-9\.]+)$/)){
        var theCallBack = outgoingCallBacks[callBackID] = callBackGenerator(callBackID, messageObj.sender, messageObj.owner);
        messageArgs.push(theCallBack);
      }
      ns[func].apply(context, messageArgs);
    }
    else{          
      debugError("execute Function ERROR: Call by client:", messageObj.sender, ":", func, "is not an exposed Samsaara Object that can be executed via the client.");
    }
  }
  else{
    debugError("execute Function ERROR: Call by client:", messageObj.sender, ":", nsName, "is not valid nameSpace.");
  }
};


// Outgoing CallBack Methods Methods
// creates a callBack to that is EXECUTED ON THE SERVER SIDE with arguments from the client

function createOutgoingCallBack(id, sender, owner){

  debug("Creating Callback");

  var theCallBack = function(){
    var args = Array.prototype.slice.call(arguments);
    if(typeof args[args.length-1] !== "function"){
      samsaara.connection(sender).executeRaw({ns:"internal", func:"callItBack", args: [id, owner, args] } );
    }
    else{
      var aCallBack = args.pop();
      samsaara.connection(sender).executeRaw({ns:"internal", func:"callItBack", args: [id, owner, args]}, aCallBack);
    }
    
    delete outgoingCallBacks[id];
  };

  // theCallBack.id = id;

  return theCallBack;
}


// Outgoing CallBack Methods Methods
// creates a callBack to that is EXECUTED ON THE SERVER SIDE with arguments from the client

function callItBack(executor, callBackID, args){

  var theCallBack = incomingCallBacks[callBackID];
  if(theCallBack !== undefined && args instanceof Array){

    if(args[0] === "samsaara.self"){
      args[0] = executor;
    }
    if(typeof arguments[arguments.length-1] === "function"){
      args.push(arguments[arguments.length-1]);
    }

    theCallBack.executeCallBack(executor.id, executor, args);
  }
}


function callItBackError(executor, callBackID, args){

  debug(core.uuid, executor.id, "CallBack Error Function Handler", callBackID, args);
  var theCallBack = incomingCallBacks[callBackID];
  if(theCallBack !== undefined){
    if(args[0] === "samsaara.self"){
      args[0] = executor;
    }
    theCallBack.callBackError(executor.id, executor, args);
  }
}


var processPacket = communication.processPacket = function(processes, packet, args, callBack){     

  for (var i = 1; i < args.length-1; i++){
    packet.args.push(args[i]);
  }
  
  if(typeof args[args.length-1] === "function"){
    makeCallBack(processes, packet, args[args.length-1], callBack);
  }
  else{
    packet.args.push(args[args.length-1]);
    callBack(null, JSON.stringify([core.uuid, packet]));
  }
};


var makeCallBack = communication.makeCallBack = function(processes, packet, theCallBack, callBack){

  var callBackID = makeUniqueCallBackID();
  var incomingCallBack = incomingCallBacks[callBackID] = new IncomingCallBack(theCallBack, callBackID, processes);
  packet.callBack = callBackID;      

  callBack(incomingCallBack, JSON.stringify([core.uuid, packet]));
};


// namespaces

var createNamespace = communication.createNamespace = function(nameSpaceName, methods){
  nameSpaces[nameSpaceName] = new NameSpace(nameSpaceName, methods);
  return nameSpaces[nameSpaceName];
};

var nameSpace = communication.nameSpace = function(nameSpaceName){
  return nameSpaces[nameSpaceName];
};


// helper methods

function makeUniqueCallBackID(){
  callBackIDOffset = callBackIDOffset++ > 1000000 ? 0 : callBackIDOffset;
  return makePseudoRandomID()+core.uuid+callBackIDOffset;
}

function makePseudoRandomID(){
  return (Math.random()*10000).toString(36);
}


exports = module.exports = {
  initialize: initialize
};


