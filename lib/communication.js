/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:communication');


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




    /**
     * Function Execution Methods
     */

    module.executeFunction = function(executor, messageObj, callBackGenerator){

      var func = messageObj.func;
      var nsName = messageObj.ns || 'core';
      var ns = nameSpace(nsName).methods;
      var messageArgs = messageObj.args || [];

      callBackGenerator = callBackGenerator || createOutgoingCallBack;

      debug("EXECUTING FUNCTION", nsName, func, executor.id);

      if(typeof ns[func] === "function"){

        debug("Function Exists in Namespace", nsName, func);

        var callBackID = messageObj.callBack;
        if(typeof callBackID === "string" && callBackID.match(/^([a-zA-Z0-9\.]+)$/)){
          var theCallBack = outgoingCallBacks[callBackID] = callBackGenerator(callBackID, messageObj.sender, messageObj.owner);
          messageArgs.push(theCallBack);
        }

        ns[func].apply(executor, messageArgs);
      }
      else{
        //Client side callBack Error?
        debug("execute Function ERROR: Call by client:", messageObj.sender, ":", func, "is not an exposed Samsaara Object that can be executed via the client.");
      }
    };



    /**
     * Outgoing CallBack Methods Methods
     * creates a callBack to that is EXECUTED ON THE SERVER SIDE with arguments from the client
     */

    function createOutgoingCallBack(id, sender, owner){

      debug("Creating Callback");

      var theCallBack = function(){
        var args = Array.prototype.slice.call(arguments);
        samsaara.connection(sender).execute({internal: "callItBack", args: [id, owner, args] } );
        delete outgoingCallBacks[id];
      };

      theCallBack.id = id;

      return theCallBack;
    }



    /**
     * Outgoing CallBack Methods Methods
     * creates a callBack to that is EXECUTED ON THE SERVER SIDE with arguments from the client
     */

    function callItBack(callBackID, args){

      var theCallBack = incomingCallBacks[callBackID];
      if(theCallBack !== undefined && args instanceof Array){
        // debug("CALL IT BACK", this.id, callBackID, args, theCallBack);
        theCallBack.executeCallBack(this.connection.id, this, args);
      }
    }


    function callItBackError(callBackID, args){

      debug(samsaaraCore.uuid, this.connection.id, "CallBack Error Function Handler", callBackID, args);
      var theCallBack = incomingCallBacks[callBackID];
      if(theCallBack !== undefined){
        // debug("BEFORE CALL IT BACK Error", this.id,callBackID, owner, args, theCallBack);
        theCallBack.callBackError(this.connection.id, this, args);
        // debug("AFTER CALL IT BACK Error", this.id,callBackID, owner, args, theCallBack);
      }
    }


    var makeCallBack = module.makeCallBack = function(processes, packet, theCallBack, callBack){

      var incomingCallBack = null;
      packet.owner = samsaaraCore.uuid;

      if(typeof theCallBack === "function"){
        // debug("MAKING CALLBACK");
        var callBackID = makeUniqueCallBackID();
        incomingCallBack = incomingCallBacks[callBackID] = new IncomingCallBack(theCallBack, callBackID, processes);
        packet.callBack = callBackID;
      }

      if(typeof callBack === "function") callBack(incomingCallBack, JSON.stringify([samsaaraCore.uuid, packet]));

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


