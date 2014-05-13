/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var path = require("path");
var moduleName = path.basename(module.filename);

var helper = require('./helper.js');
var log = require("./log.js");

var communication = {};

exports = module.exports = communication;

communication = (function communication(module){

  var samsaara = require('../index.js');
  var config = require('./config.js');

  var connectionController = require('./connectionController.js');
  var router = module.router = require('./router.js');

  var connections = connectionController.connections;

  var outgoingCallBacks = module.outgoingCallBacks = {};        //outgoing callbacks are those sent from the host when it's done executing.
  var incomingCallBacks = module.incomingCallBacks = {};        //incoming callbacks are those sent from the client when it's done executing.
  var callBackIDOffset = 0;

  var nameSpaces = module.nameSpaces = { core: {}, internal: {} };

  var IncomingCallBack = module.IncomingCallBack = require('../models/IncomingCallBack.js');



  /**
   * Main Communication and Callback Methods
   */

  module.writeTo = function(connection, packetReady){
    connection.write( packetReady );
  };


  module.sendToClient = function(connID, packet, theCallBack){

    var connection = connections[connID];

    // console.log(JSON.stringify(makeCallBack));

    makeCallBack(0, packet, theCallBack, function (callBackID, packetReady){
      // console.log("SENDING PACKET FROM STORE", packet, connID);
      if(connection !== undefined){
        if(callBackID !== null){
          incomingCallBacks[callBackID].addConnection(connection.id);
        }
        connection.write(packetReady); // will send directly or via symbolic
      }
      else{
        log.error(process.pid, moduleName, "WRITE FAILED");
      }
    });
  };



  /**
   * Public Communication Namespace Methods
   */

  module.createNamespace = function(namespace, surfaceToMain){
    if(nameSpaces[namespace] === undefined){
      nameSpaces[namespace] = {};
      if(surfaceToMain === true && samsaara[namespace] === undefined){
        samsaara[namespace] = nameSpaces[namespace];
      }
    }  
  };


  module.removeNamespace = function(namespace){  
    if(samsaara[namespace] !== undefined && samsaara[namespace] === nameSpaces[namespace] && namespace !== "core" && namespace !== "samsaara"){
      delete samsaara[namespace];
      delete nameSpaces[namespace];
    }  
  };


  module.expose = function(set, ns){

    if(ns === undefined || ns === "internal" || ns === "samsaara"){
      ns = "core";
    }

    var nameSpace = nameSpaces[ns];
    if(nameSpace === undefined){
      nameSpace = nameSpaces[ns] = {};
    }

    if(typeof set === 'object' && set !== null){
      for(var func in set){
        nameSpace[func] = set[func];
      }
    }
  };


  module.exposeNamespace = function(ns, as){
    if(nameSpaces[as] === undefined){
      nameSpaces[as] = ns;
    }
    else{
      log.error("ERROR: Namespace", as, "Already Exists or is Protected");
    }
  };



  /**
   * Function Execution Methods
   */

  module.executeFunction = function(executor, messageObj){

    var func = messageObj.func;
    var ns = messageObj.ns || 'core';
    var nameSpace = nameSpaces[ns];
    var messageArgs = messageObj.args || [];    

    // console.log("EXECUTING FUNCTION", ns, func, messageArgsnameSpace[func]);

    if(typeof nameSpace[func] === "function"){

      // console.log("EXECUTING FUNCTION", connection.id, JSON.stringify(messageObj));

      var callBackID = messageObj.callBack;
      if(typeof callBackID === "string" && callBackID.match(/^([a-zA-Z]+)$/)){
        var theCallBack = outgoingCallBacks[callBackID] = createOutgoingCallBack(callBackID, messageObj.sender, messageObj.owner);
        theCallBack.id = callBackID;
        messageArgs.push(theCallBack);
      }

      nameSpace[func].apply(executor, messageArgs);
    }
    else{
      //Client side callBack Error?
      log.error("" + process.pid, moduleName, "ERROR: Call by client:", messageObj.sender, ":", func, "is not an exposed Samsaara Object that can be executed via the client.");
    }
  };

  

  /**
   * Outgoing CallBack Methods Methods
   * creates a callBack to that is EXECUTED ON THE SERVER SIDE with arguments from the client
   */

  function createOutgoingCallBack(id, sender, owner){

    console.log("CREATING CALLBACK");

    var theCallBack = function(){
      var args = Array.prototype.slice.call(arguments);
      module.sendToClient(sender, {internal: "callItBack", args: [id, owner, args] } );
      delete outgoingCallBacks[id];
    };

    return theCallBack;
  }



  /**
   * Outgoing CallBack Methods Methods
   * creates a callBack to that is EXECUTED ON THE SERVER SIDE with arguments from the client
   */

  module.callItBack = function (callBackID, args){

    var theCallBack = incomingCallBacks[callBackID];
    if(theCallBack !== undefined && args instanceof Array){
      // console.log("CALL IT BACK", this.id, callBackID, args, theCallBack);
      theCallBack.executeCallBack(this.connection.id, this, args);
    }
    else{
      // config.redisPub.publish("CB:"+callBackID+":PRC", JSON.stringify( {connID:this.id, id: callBackID, args: args} ) );
      // config.redisSub.punsubscribe("CB:"+callBackID+"*");
    }
  };


  module.callItBackError = function (callBackID, args){

    console.log(config.uuid, moduleName, this.connection.id, "CallBack Error Function Handler", callBackID, args);
    var theCallBack = incomingCallBacks[callBackID];
    if(theCallBack !== undefined){
      // console.log("BEFORE CALL IT BACK Error", this.id,callBackID, owner, args, theCallBack);
      theCallBack.callBackError(this.connection.id, this, args);
      // console.log("AFTER CALL IT BACK Error", this.id,callBackID, owner, args, theCallBack);
    }
    else{
      // config.redisPub.publish("CB:"+callBackID+":ERR", JSON.stringify( {connID:this.id,callBackID: callBackID, owner: owner, args: args} ) );
      // config.redisSub.punsubscribe("CB:"+callBackID+"*");
    }
  };


  var makeCallBack = module.makeCallBack = function(processes, packet, theCallBack, callBack){

    var callBackID = null;
    packet.owner = config.uuid;

    if(typeof theCallBack === "function"){  
      // console.log("MAKING CALLBACK");
      callBackID = makeUniqueCallBackID();
      incomingCallBacks[callBackID] = new IncomingCallBack(theCallBack, callBackID, processes);
      packet.callBack = callBackID;      
    }

    if(typeof callBack === "function") callBack(callBackID, JSON.stringify([config.uuid, packet]));

  };


  function makeUniqueCallBackID(){
    callBackIDOffset = callBackIDOffset++ > 1000000 ? 0 : callBackIDOffset;
    return helper.makePseudoRandomID()+config.uuid+callBackIDOffset;
  }


})(communication);












