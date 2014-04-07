/*!
 * comChannel extension for argyleSocks
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var helper = require("./helper.js");

exports = module.exports = new Store();

var path = require("path");
var log = require("./log.js");
var moduleName = path.basename(module.filename);

var processID = "" + process.pid;

var connectionController = require('./connectionController.js');
var communication = require('./communication.js');

var SymbolicConnection = require('../models/symbolic.js');

var argyle;
var connections = connectionController.connections;


function Store(){

}

Store.prototype.initialize = function (parent, pub, sub, client, opts){

  argyle = parent;

  argyle.redisPub = pub;
  argyle.redisSub = sub;
  argyle.client = client;

  SymbolicConnection.initialize(pub);

  argyle.redisSub.subscribe("allProcesses");
  argyle.redisSub.subscribe(processID);
  argyle.redisSub.subscribe(processID + ":callBack");
  argyle.redisSub.subscribe("everyone:callBack");
  argyle.redisSub.subscribe("everyone");

  argyle.client.get("specialKey", function(err, reply){
    argyle.specialKey = reply;
  });

  argyle.redisSub.on("message", function (channel, message) {
    switchMessages(channel, message);
  });
};





Store.prototype.newConnection = function (connID){
  argyle.redisSub.subscribe(connID);
  argyle.client.incr("totalCurrentCount");
};


Store.prototype.closeConnection = function (connID){
  
  argyle.redisSub.unsubscribe(connID);
  argyle.client.decr("totalCurrentCount");
  var foreignContext = connections[connID].foreignContext;

  if(foreignContext !== null){
    log.info(process.pid, moduleName, "CTX: Closing Connection Request", foreignContext);
    argyle.redisPub.publish("CTX:"+foreignContext, JSON.stringify( {disconnect: connID}) );
  }
};


Store.prototype.contextSubscribe = function (contextID){
  argyle.redisSub.subscribe("CTX:" + contextID);
  argyle.client.incr("totalActiveContexts");
};




//RENAME sendToConnectionContext, make accessible through a different interface
Store.prototype.sendToContext = function (symbolic, contextID, packet, theCallBack){

  log.info(process.pid, moduleName, "SENDING TO CONTEXT", contextID);

  var callBackIDOld = theCallBack.id;

  if(callBackIDOld !== undefined){

    //forwarding the message/request to the owner of whichContext along with the callBack ID the client is listening for.
    packet.callBack = callBackIDOld;
    packet.owner = processID;

    //delete the callBack from this instance, because the it should be forwarded along to the client directly, without being parsed on this instance.
    delete communication.outgoingCallBacks[callBackIDOld];

    var packetWithSymbolicAndCallBack = '{"symbolicConnection":' + JSON.stringify(symbolic) + ',"contextMessage":' + JSON.stringify(packet) + '}';
    argyle.redisPub.publish("CTX:" + contextID, packetWithSymbolicAndCallBack);
  }  
  else{
    makeCallBack(1, symbolic, packet, theCallBack, function (symbolic, packetReady){
      var packetWithSymbolicAndCallBack = '{"symbolicConnection":' + JSON.stringify(symbolic) + ',"contextMessage":' + packetReady + '}';
      argyle.redisPub.publish("CTX:" + contextID, packetWithSymbolicAndCallBack);
    });
  }
};


//RENAME sendToConnectionOwner, make accessible through a different interface
Store.prototype.sendToOwner = function (conn, owner, packet, theCallBack){

  log.info(process.pid, moduleName, "SENDING TO OWNER", owner);
  var callBackIDOld = theCallBack.id;

  if(callBackIDOld !== undefined){
    packet.callBack = callBackIDOld;
    packet.owner = processID;

    delete communication.outgoingCallBacks[callBackIDOld];

    var packetWithCallBack = '{"proxy":"' + conn + '","proxyMessage":' + JSON.stringify(packet) + '}';
    argyle.redisPub.publish(owner, packetWithCallBack);
  }  
  else{
    makeCallBack(1, conn, packet, theCallBack, function (whichOne, packetReady){
      var packetWithCallBack = '{"proxy":"' + whichOne + '","proxyMessage":' + packetReady + '}';
      argyle.redisPub.publish(owner, packetWithCallBack);
    });
  }
};

//RENAME sendToConnectionOwner, make accessible through a different interface
Store.prototype.sendToForeign = function (type, objID, packet, theCallBack){
  log.info(process.pid, moduleName, "SENDING TO FOREIGN", type, objID);

  var prefix;

  switch(type){
    case "Context":
      prefix = "CTX:"; 
      break;
    case "User":
      prefix = "USR:"; 
      break;
  }

  var channel = prefix + objID;

  makeCallBack(1, objID, packet, theCallBack, function (objID, packetReady){
    var packetWithCallBack = packetReady;
    argyle.redisPub.publish(channel, packetWithCallBack);
  });
};






Store.prototype.sendTo = function (who, packet, theCallBack){

  //console.log(process.pid, "SENDING TO", who);

  //EVERYONE//////////////////////////////////////////////////////
  if(who === "everyone"){
    argyle.client.get("totalClientCount",  function(err, totalClientCount) {
      makeCallBack(totalClientCount, who, packet, theCallBack, function (everyone, packetReady){
        argyle.redisPub.publish("everyone", packetReady);
      });
    });
  }


  //GROUP//////////////////////////////////////////////////////
  else if(typeof who === "object" && who !== null){

    var lengthOfGroup = Object.keys(who).length;

    //USE Redis QUEUE Thing
   
    makeCallBack(lengthOfGroup, who, packet, theCallBack, function (group, packetReady){

      for (var connID in group) {
        // if(connections[connID] !== undefined && connections[connID].connectionClass === "native"){
        if(connections[connID] !== undefined){
          writeTo(connections[connID], packetReady);
        }
        else{
          log.error(process.pid, moduleName, "WRITE FAILED");
          // argyle.redisPub.publish(connID, packetReady);
        }        
      }
    });
  }


  //SINGLE//////////////////////////////////////////////////////
  else if(typeof who === "string"){

    var whichOne = connections[who];

    makeCallBack(1, who, packet, theCallBack, function (connID, packetReady){
      // if(whichOne !== undefined && whichOne.connectionClass === "native"){
      if(whichOne !== undefined){
        //console.log(process.pid, "SENDING LOCALLY", who, connections[connID].connectionClass);
        writeTo(whichOne, packetReady);
      }
      else{
        //console.log(process.pid, "PUBLISHING", who, connections[connID].connectionClass);
        log.error(process.pid, moduleName, "WRITE FAILED");
        // argyle.redisPub.publish(connID, packetReady);
      }
    });
  }
};


/*
Generates a callBack referenceID for the
passed in callBack and tags on a few other
meta references, and then packages the message
*/

function makeCallBack(numberOfClients, who, packet, theCallBack, callBack){
  var packetReadyJSON = packet;

  if(theCallBack && typeof theCallBack === "function"){

    var execFrom = this;
    var callBackID = helper.makeIdAlpha(12);
    // var callBackKey = helper.makeIdAlphaNumerical(20);

    communication.incomingCallBacks[callBackID] = {
      callBack: theCallBack,
      from: execFrom
    };

    communication.incomingCallBacksCount[callBackID] = {
      total: numberOfClients,
      executed: 0
    };

    packetReadyJSON.callBack = callBackID;
    packetReadyJSON.owner = processID;
  }

  if(callBack && typeof callBack === "function"){
    callBack(who, JSON.stringify(packetReadyJSON) );
  }
}

function writeTo(conn, packetReady){
  conn.write( packetReady );
}


function numberOfEveryone(callBack){
  argyle.client.get("totalClientCount", function (err, total) {
    if(callBack && typeof callBack === "function") callBack(total);
  });
}




function switchMessages(channel, message){

  log.info(process.pid, moduleName, "received message on channel", channel);
  var messageObj;

  switch(channel){
    case processID:
      messageObj = JSON.parse(message);
      log.info(process.pid, moduleName, "OWNER MESSAGE:", message);
      
      if(messageObj.proxy){

        var proxy = messageObj.proxy;
        log.info(process.pid, moduleName, "OWNER MESSAGE proxy:", proxy);

        if(connections[proxy] !== undefined){
          caller = connections[proxy];
          communication.receiveMsg.call(caller, messageObj.proxyMessage);
        }
      }
      else if(messageObj.func){
        communication.receiveMsg(messageObj);
      }
      break;


    case processID + ":callBack":
      messageObj = JSON.parse(message);
      argyle.callItBack(messageObj.id, messageObj.owner, messageObj.args);
      break;


    case "everyone":
      for (var client in connections) {
        whichOne = connections[client];
        if (whichOne.connectionClass === "native"){
          writeTo(whichOne, message);
        }        
      }
      break;


    case "allProcesses":
      messageObj = JSON.parse(message);
      communication.receiveMsg(messageObj);
      break;



    default:
      //Test other channels, but assume that it might be to a connection

      var whichOneGuess = connections[channel];

      if(whichOneGuess !== undefined && whichOneGuess.connectionClass === "native"){
        writeTo(connections[channel], message);
      }

      else{

        var subStr = channel.substring(0,4);

        if(subStr === "CTX:"){

          messageObj = JSON.parse(message);
          var nativeID;
          var caller;

          if(messageObj.nativeID){
            communication.receiveMsg.call(connections[messageObj.nativeID], messageObj.contextMessage);
          }
          else if(messageObj.symbolicConnection){
            var symbolicData = messageObj.symbolicConnection;
            // console.log("SYMBOLIC DATA", symbolicData);
            caller = connections[symbolicData.nativeID] = new SymbolicConnection(symbolicData, argyle.redisPub);
            communication.receiveMsg.call(caller, messageObj.contextMessage);
          }

          else if(messageObj.disconnect !== undefined && connections[messageObj.disconnect] !== undefined){

            var whichOne = connections[messageObj.disconnect];
            var connID = whichOne.id;

            log.info(process.pid, moduleName, "FOREIGN DISCONNECT: ", whichOne.id);

            argyle.emit("disconnect", whichOne);

            for(var key in argyle.groups){
              if(argyle.groups[key][connID] !== undefined){
                delete argyle.groups[key][connID];
              }
            }

            delete connections[connID];

          }
        }
        else if(subStr === "USR:"){
          messageObj = JSON.parse(message);
          log.info(process.pid, moduleName, "THIS IS THE MESSAGE:", message);
          communication.receiveMsg(messageObj);
        }
      }
      break;
  }
}

