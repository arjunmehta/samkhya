/*!
 * comChannel extension for Samsaara
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
var grouping = require('./grouping.js');

var SymbolicConnection = require('../models/symbolic.js');

var makeCallBack = communication.makeCallBack;
var writeTo = communication.writeTo;

var samsaara;
var connections = connectionController.connections;
var groups = grouping.groups;

function Store(){

}

Store.prototype.initialize = function (parent, pub, sub, client, opts){

  samsaara = parent;

  samsaara.redisPub = pub;
  samsaara.redisSub = sub;
  samsaara.client = client;

  SymbolicConnection.initialize(pub);

  samsaara.redisSub.subscribe("allProcesses");
  samsaara.redisSub.subscribe(processID);
  samsaara.redisSub.subscribe(processID + ":callBack");
  samsaara.redisSub.subscribe("everyone:callBack");
  samsaara.redisSub.subscribe("everyone");

  samsaara.client.get("specialKey", function(err, reply){
    samsaara.specialKey = reply;
  });

  samsaara.redisSub.on("message", function (channel, message) {
    switchMessages(channel, message);
  });
};





Store.prototype.newConnection = function (connID){
  samsaara.redisSub.subscribe(connID);
  samsaara.client.incr("totalCurrentCount");
};


Store.prototype.closeConnection = function (connID){

  samsaara.redisSub.unsubscribe(connID);
  samsaara.client.decr("totalCurrentCount");
  var foreignContext = connections[connID].foreignContext;

  if(foreignContext !== null){
    log.info(process.pid, moduleName, "CTX: Closing Connection Request", foreignContext);
    samsaara.redisPub.publish("CTX:"+foreignContext, JSON.stringify( {disconnect: connID}) );
  }
};


Store.prototype.contextSubscribe = function (contextID){
  samsaara.redisSub.subscribe("CTX:" + contextID);
  samsaara.client.incr("totalActiveContexts");
};


Store.prototype.groupSubscribe = function (groupName){
  samsaara.redisSub.subscribe("GRP:" + groupName);
  samsaara.client.incr("totalGroups");
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
    samsaara.redisPub.publish("CTX:" + contextID, packetWithSymbolicAndCallBack);
  }
  else{
    makeCallBack(1, symbolic, packet, theCallBack, function (symbolic, packetReady){
      var packetWithSymbolicAndCallBack = '{"symbolicConnection":' + JSON.stringify(symbolic) + ',"contextMessage":' + packetReady + '}';
      samsaara.redisPub.publish("CTX:" + contextID, packetWithSymbolicAndCallBack);
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
    samsaara.redisPub.publish(owner, packetWithCallBack);
  }
  else{
    makeCallBack(1, conn, packet, theCallBack, function (whichOne, packetReady){
      var packetWithCallBack = '{"proxy":"' + whichOne + '","proxyMessage":' + packetReady + '}';
      samsaara.redisPub.publish(owner, packetWithCallBack);
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
    samsaara.redisPub.publish(channel, packetWithCallBack);
  });
};



Store.prototype.sendToGroup = function(who, packet, theCallBack){
  if(who === "everyone"){
    samsaara.client.get("totalCurrentCount", function (err, totalCurrentCount){
      makeCallBack(totalCurrentCount, who, packet, theCallBack, function (everyone, packetReady){
        samsaara.redisPub.publish("everyone", packetReady);
      });
    });
  }
  else{
    samsaara.client.get("GRP:"+who+"Count", function (err, groupCount){
      makeCallBack(groupCount, who, packet, theCallBack, function (groupName, packetReady){
        samsaara.redisPub.publish("GRP:"+groupName, packetReady);
      });
    });
  }
};


Store.prototype.sendTo = function (who, packet, theCallBack){

  //console.log(process.pid, "SENDING TO", who);

  //EVERYONE//////////////////////////////////////////////////////
  if(who === "everyone"){
    samsaara.client.get("totalCurrentCount", function (err, totalCurrentCount){
      makeCallBack(totalCurrentCount, who, packet, theCallBack, function (everyone, packetReady){
        samsaara.redisPub.publish("everyone", packetReady);
      });
    });
  }


  //GROUP//////////////////////////////////////////////////////
  else if(typeof who === "object" && who !== null){

    var lengthOfGroup = Object.keys(who).length;

    //USE Redis QUEUE Thing

    makeCallBack(lengthOfGroup, who, packet, theCallBack, function (group, packetReady){

      for (var connID in group) {
        if(connections[connID] !== undefined){
          writeTo(connections[connID], packetReady);
        }
        else{
          log.error(process.pid, moduleName, "WRITE FAILED");
        }
      }
    });
  }


  //SINGLE//////////////////////////////////////////////////////
  else if(typeof who === "string"){

    var whichOne = connections[who];

    makeCallBack(1, who, packet, theCallBack, function (connID, packetReady){
      if(whichOne !== undefined){
        writeTo(whichOne, packetReady); // will send directly or via symbolic
      }
      else{
        log.error(process.pid, moduleName, "WRITE FAILED");
      }
    });
  }
};


/*
Generates a callBack referenceID for the
passed in callBack and tags on a few other
meta references, and then packages the message
*/


function numberOfEveryone(callBack){
  samsaara.client.get("totalCurrentCount", function (err, total) {
    if(callBack && typeof callBack === "function") callBack(total);
  });
}


function switchMessages(channel, message){

  log.info(process.pid, moduleName, "received message on channel", channel);
  var messageObj, whichOne, connID, caller = null;

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
      // console.log("MESSAGE", message);
      messageObj = JSON.parse(message);
      caller = {id: messageObj.connID};
      // console.log("CALLER", caller);
      communication.callItBack.call(caller, messageObj.id, messageObj.owner, messageObj.args);
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

          if(messageObj.nativeID){
            communication.receiveMsg.call(connections[messageObj.nativeID], messageObj.contextMessage);
          }
          else if(messageObj.symbolicConnection){
            var symbolicData = messageObj.symbolicConnection;
            // console.log("SYMBOLIC DATA", symbolicData);
            caller = connections[symbolicData.nativeID] = new SymbolicConnection(symbolicData, samsaara.redisPub);
            communication.receiveMsg.call(caller, messageObj.contextMessage);
          }

          else if(messageObj.disconnect !== undefined && connections[messageObj.disconnect] !== undefined){

            whichOne = connections[messageObj.disconnect];
            connID = whichOne.id;

            log.info(process.pid, moduleName, "FOREIGN DISCONNECT: ", whichOne.id);

            samsaara.emit("disconnect", whichOne);

            for(var key in samsaara.groups){
              if(samsaara.groups[key][connID] !== undefined){
                delete samsaara.groups[key][connID];
              }
            }

            delete connections[connID];

          }
        }
        else if(subStr === "GRP:"){

          var groupName = channel.substring(4);

          for(connID in groups[groupName]){
            whichOne = connections[connID];
            if (whichOne.connectionClass === "native"){
              writeTo(whichOne, message);
            }
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

