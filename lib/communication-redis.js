/*!
 * comChannel extension for Samsaara
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = new Store();

var path = require("path");
var moduleName = path.basename(module.filename);
var processID = "" + process.pid;

var helper = require("./helper.js");
var log = require("./log.js");

var samsaara = require('../index.js');
var connectionController = require('./connectionController.js');
var communication = require('./communication.js');
var grouping = require('./grouping.js');

var config = require('./config');

var SymbolicConnection,
    IncomingCallBack;

// var makeCallBack = communication.makeCallBack;
var writeTo = communication.writeTo;
var connections = connectionController.connections;
var groups = grouping.groups;

var redisSub,
    redisPub,
    redisClient;

init();

function Store(){}

function init(){

  redisPub = config.redisPub;
  redisSub = config.redisSub;
  redisClient = config.redisClient;

  redisSub.psubscribe("PRC:"+config.uuid+"*");
  redisSub.subscribe("ALLPROCESS:");

  redisSub.on("message", function (channel, message) {
    switchMessages(channel, message);
  });

  redisSub.on("pmessage", function (pattern, channel, message) {
    switchPMessages(pattern, channel, message);
  });

  SymbolicConnection = require('../models/symbolic.js');
  IncomingCallBack = require('../models/IncomingCallBack.js');

}


exports.newConnection = function (connID){
  redisSub.subscribe("NTV:"+connID);
  redisClient.incr("totalCurrentCount");
};

exports.closeConnection = function (connID){

  redisSub.unsubscribe("NTV:"+connID);
  redisClient.decr("totalCurrentCount");
  var foreignContext = connections[connID].foreignContext;

  if(foreignContext !== null){
    log.info(process.pid, moduleName, "CTX: Closing Connection Request", foreignContext);
    redisPub.publish("CTX:"+foreignContext, JSON.stringify( {disconnect: connID}) );
  }
};





exports.contextSubscribe = function (contextID){
  redisSub.subscribe("CTX:" + contextID);
  redisClient.incr("totalActiveContexts");
};

exports.groupSubscribe = function (groupName){
  redisSub.subscribe("GRP:" + groupName);
  redisClient.incr("totalGroups");
};

//RENAME sendToConnectionContext, make accessible through a different interface
exports.sendToContext = function (symbolic, contextID, packet, theCallBack){

  var callBackIDOld = theCallBack.id;
  console.log(process.pid, moduleName, "SENDING TO CONTEXT", contextID, callBackIDOld, symbolic.id);

  if(callBackIDOld !== undefined){

    packet.callBack = callBackIDOld;
    packet.owner = processID;

    var packetWithSymbolicAndCallBack = '{"symbolicConnection":' + JSON.stringify(symbolic) + ',"contextMessage":' + JSON.stringify(packet) + '}';

    redisPub.publish("CTX:" + contextID, packetWithSymbolicAndCallBack);
    delete communication.outgoingCallBacks[callBackIDOld];
  }
  else{    

    // packet.interProcess = true; DO SOMETHING INSTEAD OF THIS. USE CHANNEL.
    console.log("RAW PACKET", packet);

    makeCallBack(false, packet, theCallBack, function (callBackID, packetReady){
      var packetWithSymbolicAndCallBack = '{"symbolicConnection":' + JSON.stringify(symbolic) + ',"contextMessage":' + packetReady + '}';
      redisPub.publish("CTX:" + contextID, packetWithSymbolicAndCallBack);
    });
  }
};


//RENAME sendToConnectionOwner, make accessible through a different interface
exports.sendToOwner = function (connID, owner, packet, theCallBack){

  console.log(process.pid, moduleName, "SENDING TO OWNER", owner, connID);
  var callBackIDOld = theCallBack.id;

  if(callBackIDOld !== undefined){
    packet.callBack = callBackIDOld;
    packet.owner = processID;

    var packetWithCallBack = JSON.stringify(packet);
    redisPub.publish("PRC:"+owner+":PRX:"+connID, packetWithCallBack);

    delete communication.outgoingCallBacks[callBackIDOld];
  }
  else{
    makeCallBack(1, packet, theCallBack, function (callBackID, packetReady){
      redisPub.publish("PRC:"+owner+":PRX:"+connID, packetReady);
    });
  }
};

exports.sendToGroup = function(who, packet, theCallBack){  

  makeCallBack(true, packet, theCallBack, function (callBackID, packetReady){
    console.log(process.pid, "SENDING TO GROUP:", who, packet);
    if(callBackID !== null){
      redisPub.publish("GRP:"+who+":CB:"+callBackID, packetReady);
    }
    else{
      redisPub.publish("GRP:"+who, packetReady);
    }    
  });
};


exports.sendToClient = function(who, packet, theCallBack){

  var whichOne = connections[who];
  makeCallBack(false, packet, theCallBack, function (callBackID, packetReady){
    if(whichOne !== undefined){
      if(callBackID !== null){
        communication.incomingCallBacks[callBackID].addConnection(whichOne.id);
      }
      writeTo(whichOne, packetReady); // will send directly or via symbolic
    }
    else{
      log.error(process.pid, moduleName, "WRITE FAILED");
    }
  });
};


exports.sendTo = function (who, packet, theCallBack){
  if(who.group !== undefined){
    this.sendToGroup(who.group, packet, theCallBack);
  }
  else if(who.client !== undefined){
    this.sendToClient(who.client, packet, theCallBack);
  }
};



function switchPMessages(pattern, channel, message){

  var channelSplit = channel.split(":");

  switch(channelSplit[0]){
    case "CB":
      handleCallBackMessage(channelSplit[1], channelSplit[2], channelSplit[3], message);
      break;

    case "PRC":
      // console.log("PROCESS MESSAGE", channelSplit, message);
      handleProcessMessage(channelSplit[2], channelSplit[3], channelSplit[4], message);
      break;

    case "GRP":
      // console.log("GROUP MESSAGE", channelSplit, message);
      handleGroupMessage(channelSplit[1], channelSplit[3], message);
      break;

    default:
      break;
  }
}


function handleGroupMessage(groupName, callBackID, message){

  // console.log(process.pid, "GROUP MESSAGE SEND MESSAGE TO LOCAL GROUP", groupName, callBackID, message);

  var connID, whichOne;

  if(callBackID !== undefined){

    var sendArray = [];
    var callBackList = "";

    for(connID in groups[groupName]){
      whichOne = connections[connID];
      if(whichOne.connectionClass === "native"){
        sendArray.push(whichOne);
        callBackList += connID + ":";
      }
    }

    redisPub.publish("CB:"+callBackID+":LST", callBackList);
    for(var i=0; i<sendArray.length; i++){
      writeTo(sendArray[i], message);
    }

    // What happens if a connection drops in the middle of this process?
  }
  else{
    for(connID in groups[groupName]){
      whichOne = connections[connID];
      if (whichOne.connectionClass === "native"){
        writeTo(whichOne, message);
      }
    }
  }
}

function handleCallBackMessage(callBackID, switchID, connID, message){

  switch(switchID){
    case "CBK":
      break;

    case "LST":
      addCallBackConnections(callBackID, message);
      break;

    case "PRC":
      processCallBack(callBackID, message);
      break;

    case "SYM":
      symbolicCallBack(callBackID, connID, message);
      break;

    case "ERR":
      callBackError(callBackID, message);
      break;

    default:
      break;
  }
}

function handleProcessMessage(switchID, connID, token, message){

  switch(switchID){
    case "PRX":
      proxyMessage(connID, message);
      break;

    case "RCV":
      proxyMessage(connID, token, message);
      break;

    default:
      break;
  }
}


function switchMessages(channel, message){

  // console.log(process.pid, moduleName, "received message on channel", channel);

  var split = channel.split(":");

  switch(split[0]){

    case "NTV":
      sendMessageToNativeConnection(split[1], message);
      break;

    case "CTX":
      sendMessageToLocalContext(split[1], message);
      break;

    case "USR":
      messageObj = parseMessage(message);
      log.info(process.pid, moduleName, "THIS IS THE MESSAGE:", message);
      communication.receiveMsg(messageObj);
      break;

    case "ALLPRC":
      processMessage(message);
      break;

    default:
      break;

  }
}

function sendMessageToNativeConnection(connID, message){
  var whichOne = connections[connID];
  if(whichOne !== undefined && whichOne.connectionClass === "native"){
    writeTo(whichOne, message);
  }
}

function processMessage(message){
  var messageObj = parseMessage(message);  
  communication.receiveMsg(messageObj);
}

function processCallBack(callBackID, message){
  var messageObj = parseMessage(message);
  var caller = {id: messageObj.connID}; // BAH. This is a flaw in the system.
  communication.callItBack.call(caller, callBackID, messageObj.owner, messageObj.args);
}

function symbolicCallBack(callBackID, connID, message){
  var messageObj = parseMessage(message);
  var caller = connections[connID]; // BAH. This is a flaw in the system.
  if(caller !== undefined){
    communication.callItBack.call(caller, callBackID, messageObj.owner, messageObj.args);
  }
}

function callBackError(callBackID, message){
  var messageObj = parseMessage(message);
  caller = {id: messageObj.connID}; // BAH. This is a flaw in the system.
  communication.callItBackError.call(caller, callBackID, messageObj.owner, messageObj.args);
}


function proxyMessage(connID, token, message){
  var messageObj = parseMessage(message);
  console.log(process.pid, moduleName, "OWNER MESSAGE proxy:", connID);
  var caller = connections[connID];
  if(caller !== undefined){
    communication.receiveMsg.call(caller, messageObj, token);
  }
  else{
    communication.receiveMsg.call({id: connID}, messageObj, token);
  }
}

function parseMessage(message){
  try{
    return JSON.parse(message)[1];
  }
  catch(e){
    return console.log("INVALID JSON to Parse", e);
  }
}

function newSymbolicConnnection(symbolicConnID, message){
  var messageObj = parseMessage(message);
  var symbolicData = messageObj.symbolicConnection;
  // console.log("SYMBOLIC DATA", symbolicData);
  var caller = connections[symbolicConnID] = new SymbolicConnection(symbolicData, redisPub);
  communication.receiveMsg.call(caller, messageObj.contextMessage);
}


function sendMessageToLocalContext(contextID, message){

  var messageObj = parseMessage(message);
  var nativeID;          

  if(messageObj.nativeID){
    communication.receiveMsg.call(connections[messageObj.nativeID], messageObj.contextMessage);
  }
  else if(messageObj.symbolicConnection){
    var symbolicData = messageObj.symbolicConnection;
    // console.log("SYMBOLIC DATA", symbolicData);
    caller = connections[symbolicData.nativeID] = new SymbolicConnection(symbolicData, redisPub);
    communication.receiveMsg.call(caller, messageObj.contextMessage);
  }

  else if(messageObj.disconnect !== undefined && connections[messageObj.disconnect] !== undefined){

    whichOne = connections[messageObj.disconnect];
    connID = whichOne.id;

    log.info(process.pid, moduleName, "FOREIGN DISCONNECT: ", whichOne.id);

    config.emit("disconnect", whichOne);

    for(var key in groups){
      if(groups[key][connID] !== undefined){
        delete groups[key][connID];
      }
    }
    delete connections[connID];
  }
}

// function sendMessageToLocalGroup(groupName, message){

//   // console.log(process.pid, "SEND MESSAGE TO LOCAL GROUP", groupName);

//   var messageObj = JSON.parse(message);
//   var sendPacket = messageObj.packet;
//   var callBackID = messageObj.callBack;
//   var connID, whichOne;

//   if(callBackID !== null){

//     var sendArray = [];
//     var callBackList = "";

//     for(connID in groups[groupName]){
//       whichOne = connections[connID];
//       if(whichOne.connectionClass === "native"){
//         sendArray.push(whichOne);
//         callBackList += connID + ":";
//       }
//     }

//     redisPub.publish("CB:"+callBackID+":LST", callBackList);
//     for(var i=0; i<sendArray.length; i++){
//       writeTo(sendArray[i], sendPacket);
//     }

//     // What happens if a connection drops in the middle of this process?
//   }
//   else{
//     for(connID in groups[groupName]){
//       whichOne = connections[connID];
//       if (whichOne.connectionClass === "native"){
//         writeTo(whichOne, sendPacket);
//       }
//     }
//   }
// }


function addCallBackConnections(callBackID, message){
  var connectionsArray =  message.split(":");
  connectionsArray.pop();
  // console.log("ADDING CALL BACK CONNECTIONS", callBackID, connectionsArray);
  communication.incomingCallBacks[callBackID].addConnections(connectionsArray);
}


var makeCallBack = function(remote, packetReadyJSON, theCallBack, callBack){

  var callBackID = null;

  if(typeof theCallBack === "function"){
    callBackID = makeUniqueCallBackID();
    communication.incomingCallBacks[callBackID] = new IncomingCallBack(theCallBack, callBackID, remote);
    packetReadyJSON.callBack = callBackID;
    packetReadyJSON.owner = config.uuid;
  }

  if(typeof callBack === "function") callBack(callBackID, JSON.stringify([config.uuid, packetReadyJSON]));

};


function makeUniqueCallBackID(){
  return helper.makeIdAlpha(12)+processID+(new Date().getTime());
}
