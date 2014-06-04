/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:communication');
var debugExecution = require('debug')('samsaara:communication:execution');
var debugError = require('debug')('samsaara:communication:error');


// creating our exported object

var communication = {};


function initialize(samsaaraCore){


  (function communication(module){


    var samsaara = samsaaraCore.samsaara;

    // init namespaces

    var nameSpaces = {};
    var NameSpace = module.NameSpace = require('../models/namespace.js').NameSpace;

    module.nameSpace = nameSpace;
    module.createNamespace = createNamespace;

    createNamespace("internal", {
      callItBack: callItBack,
      callItBackError: callItBackError
    });


    // init callbacks

    var outgoingCallBacks = module.outgoingCallBacks = {};        //outgoing callbacks are those sent from the host when it's done executing.
    var incomingCallBacks = module.incomingCallBacks = {};        //incoming callbacks are those sent from the client when it's done executing.
    var callBackIDOffset = 0;

    var IncomingCallBack = module.IncomingCallBack = require('../models/callback.js').IncomingCallBack;


    // Main Communication and Callback Methods

    module.writeTo = function(connection, packetReady){
      connection.write( packetReady );
    };

    // Public Communication Namespace Methods

    module.expose = function(set){
      nameSpace("core").expose(set);

      return samsaara;
    };




    // 
    // Function Execution Methods
    // 

    module.executeFunction = function(executor, context, messageObj, callBackGenerator){

      var func = messageObj.func;
      var nsName = messageObj.ns || 'internal';
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
        samsaara.connection(sender).executeRaw({ns:"internal", func:"callItBack", args: [id, owner, args] } );
        delete outgoingCallBacks[id];
      };

      theCallBack.id = id;

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

        theCallBack.executeCallBack(executor.id, executor, args);
      }
    }


    function callItBackError(executor, callBackID, args){

      debug(samsaaraCore.uuid, executor.id, "CallBack Error Function Handler", callBackID, args);
      var theCallBack = incomingCallBacks[callBackID];
      if(theCallBack !== undefined){

        if(args[0] === "samsaara.self"){
          args[0] = executor;
        }

        theCallBack.callBackError(executor.id, executor, args);
      }
    }


    var processPacket = module.processPacket = function(processes, packet, args, callBack){     

      for (var i = 1; i < args.length-1; i++){
        packet.args.push(args[i]);
      }

      if(typeof args[args.length-1] === "function"){
        makeCallBack(processes, packet, args[args.length-1], callBack);
      }
      else{
        packet.args.push(args[args.length-1]);
        callBack(null, JSON.stringify([samsaaraCore.uuid, packet]));
      }
    };


    var makeCallBack = module.makeCallBack = function(processes, packet, theCallBack, callBack){

      var callBackID = makeUniqueCallBackID();
      var incomingCallBack = incomingCallBacks[callBackID] = new IncomingCallBack(theCallBack, callBackID, processes);
      packet.callBack = callBackID;      

      callBack(incomingCallBack, JSON.stringify([samsaaraCore.uuid, packet]));
    };


    function makeUniqueCallBackID(){
      callBackIDOffset = callBackIDOffset++ > 1000000 ? 0 : callBackIDOffset;
      return makePseudoRandomID()+samsaaraCore.uuid+callBackIDOffset;
    }


    // namespaces

    function createNamespace(nameSpaceName, methods){
      nameSpaces[nameSpaceName] = new NameSpace(nameSpaceName, methods);
      return nameSpaces[nameSpaceName];
    }

    function nameSpace(nameSpaceName){
      return nameSpaces[nameSpaceName];
    }


  })(communication);


  return communication;

}


function makePseudoRandomID(){
  return (Math.random()*10000).toString(36);
}


exports = module.exports = {
  initialize: initialize
};


