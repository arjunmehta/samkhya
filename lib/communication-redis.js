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

var SymbolicConnection = require('../models/symbolic.js');
var IncomingCallBack = require('../models/IncomingCallBack.js');

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

  // IncomingCallBack.initialize(redisSub, communication.incomingCallBacks);

  redisSub.psubscribe("PRC:"+processID+"*");
  redisSub.subscribe("ALLPROCESS:");

  redisSub.on("message", function (channel, message) {
    switchMessages(channel, message);
  });

  redisSub.on("pmessage", function (pattern, channel, message) {
    switchPMessages(pattern, channel, message);
  });

}


Store.prototype.newConnection = function (connID){
  redisSub.subscribe("NTV:"+connID);
  redisClient.incr("totalCurrentCount");
};


Store.prototype.closeConnection = function (connID){

  redisSub.unsubscribe("NTV:"+connID);
  redisClient.decr("totalCurrentCount");
  var foreignContext = connections[connID].foreignContext;

  if(foreignContext !== null){
    log.info(process.pid, moduleName, "CTX: Closing Connection Request", foreignContext);
    redisPub.publish("CTX:"+foreignContext, JSON.stringify( {disconnect: connID}) );
  }
};


Store.prototype.contextSubscribe = function (contextID){
  redisSub.subscribe("CTX:" + contextID);
  redisClient.incr("totalActiveContexts");
};


Store.prototype.groupSubscribe = function (groupName){
  redisSub.subscribe("GRP:" + groupName);
  redisClient.incr("totalGroups");
};



//RENAME sendToConnectionContext, make accessible through a different interface
Store.prototype.sendToContext = function (symbolic, contextID, packet, theCallBack){

  var callBackIDOld = theCallBack.id;
  console.log(process.pid, moduleName, "SENDING TO CONTEXT", contextID, callBackIDOld, symbolic.id);

  if(callBackIDOld !== undefined){

    //forwarding the message/request to the owner of whichContext along with the callBack ID the client is listening for.
    packet.callBack = callBackIDOld;
    packet.owner = processID;

    //delete the callBack from this instance, because it should be forwarded along to the client directly, without being parsed on this instance.
    delete communication.outgoingCallBacks[callBackIDOld];

    var packetWithSymbolicAndCallBack = '{"symbolicConnection":' + JSON.stringify(symbolic) + ',"contextMessage":' + JSON.stringify(packet) + '}';

    // console.log("SENDING TO CONTEXT", packetWithSymbolicAndCallBack);

    redisPub.publish("CTX:" + contextID, packetWithSymbolicAndCallBack);
  }
  else{
    console.log("RAW PACKET", packet);
    packet.interProcess = true;
    makeCallBack(false, symbolic, packet, theCallBack, function (symbolic, packetReady, callBackID){
      var packetWithSymbolicAndCallBack = '{"symbolicConnection":' + JSON.stringify(symbolic) + ',"contextMessage":' + packetReady + '}';
      // console.log("MADE PACKET WITH CALLBACK AND SENDING TO CONTEXT", packetWithSymbolicAndCallBack);
      redisPub.publish("CTX:" + contextID, packetWithSymbolicAndCallBack);
    });
  }
};


//RENAME sendToConnectionOwner, make accessible through a different interface
Store.prototype.sendToOwner = function (connID, owner, packet, theCallBack){

  console.log(process.pid, moduleName, "SENDING TO OWNER", owner, connID);
  var callBackIDOld = theCallBack.id;

  if(callBackIDOld !== undefined){
    packet.callBack = callBackIDOld;
    packet.owner = processID;

    delete communication.outgoingCallBacks[callBackIDOld];

    var packetWithCallBack = JSON.stringify(packet);
    redisPub.publish("PRC:"+owner+":PRX:"+connID, packetWithCallBack);
  }
  else{
    makeCallBack(1, connID, packet, theCallBack, function (whichOne, packetReady, callBackID){
      var packetWithCallBack = packetReady;
      redisPub.publish("PRC:"+owner+":PRX:"+connID, packetWithCallBack);
    });
  }
};






Store.prototype.sendToGroup = function(who, packet, theCallBack){  

  makeCallBack(true, who, packet, theCallBack, function (everyone, packetReady, callBackID){
    console.log(process.pid, "SENDING TO GROUP:", who, packet);
    redisPub.publish("GRP:"+who, JSON.stringify({callBack: callBackID, packet: packetReady}) );
  });
};

Store.prototype.sendToClient = function(who, packet, theCallBack){

    var whichOne = connections[who];
    makeCallBack(false, who, packet, theCallBack, function (connID, packetReady, callBackID){
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


Store.prototype.sendTo = function (who, packet, theCallBack){
  if(who.group !== undefined){
    this.sendToGroup(who.group, packet, theCallBack);
  }
  else if(who.client !== undefined){
    this.sendToClient(who.client, packet, theCallBack);
  }
};



function switchPMessages(pattern, channel, message){

  // console.log("PMESSAGE", pattern, channel, message);

  // objects will subscribe to more defined patterns, like callBacks will
  // subscribe to the CB:982ykjha82287ta pattern that will have dinstinct channels
  // CB:982ykjha82287ta:CBK, CB:982ykjha82287ta:LST, CB:982ykjha82287ta:PRC, CB:982ykjha82287ta:ERR

  // PRC

  var channelSplit = channel.split(":");

  switch(channelSplit[0]){

    case "CB":
      handleCallBackMessage(channelSplit[1], channelSplit[2], message);
      break;

    case "PRC":
      handleProcessMessage(channelSplit[2], channelSplit[3], message);
      break;

    default:
      break;
  }

}

function handleCallBackMessage(callBackID, switchID, message){

  switch(switchID){
    case "CBK":
      break;

    case "LST":
      addCallBackConnections(callBackID, message);
      break;

    case "PRC":
      processCallBack(callBackID, message);
      break;

    case "ERR":
      callBackError(callBackID, message);
      break;

    default:
      break;
  }
}

function handleProcessMessage(switchID, ID, message){

  switch(switchID){
    case "PRX":
      proxyMessage(ID, message);
      break;

    case "EXC":
      processMessage(message);
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

      case "GRP":
        sendMessageToLocalGroup(split[1], message);
        break;

      case "USR":
        messageObj = JSON.parse(message);
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
  var messageObj = JSON.parse(message);  
  communication.receiveMsg(messageObj);
}

function processCallBack(callBackID, message){
  var messageObj = JSON.parse(message);
  caller = {id: messageObj.connID}; // BAH. This is a flaw in the system.
  communication.callItBack.call(caller, callBackID, messageObj.owner, messageObj.args);
}

function callBackError(callBackID, message){
  var messageObj = JSON.parse(message);
  caller = {id: messageObj.connID}; // BAH. This is a flaw in the system.
  communication.callItBackError.call(caller, callBackID, messageObj.owner, messageObj.args);
}


function proxyMessage(connID, message){
  var messageObj = JSON.parse(message);
  console.log(process.pid, moduleName, "OWNER MESSAGE proxy:", connID);
  var caller = connections[connID];
  if(caller !== undefined){
    communication.receiveMsg.call(caller, messageObj);
  }
}


function newSymbolicConnnection(symbolicConnID, message){
  var messageObj = JSON.parse(message);
  var symbolicData = messageObj.symbolicConnection;
  // console.log("SYMBOLIC DATA", symbolicData);
  var caller = connections[symbolicConnID] = new SymbolicConnection(symbolicData, redisPub);
  communication.receiveMsg.call(caller, messageObj.contextMessage);
}


function sendMessageToLocalContext(contextID, message){

  var messageObj = JSON.parse(message);
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

function sendMessageToLocalGroup(groupName, message){

  // console.log(process.pid, "SEND MESSAGE TO LOCAL GROUP", groupName);

  var messageObj = JSON.parse(message);
  var sendPacket = messageObj.packet;
  var callBackID = messageObj.callBack;
  var connID, whichOne;

  if(callBackID !== null){

    var sendArray = [];
    var callBackArray = [];

    for(connID in groups[groupName]){
      whichOne = connections[connID];
      if (whichOne.connectionClass === "native"){
        sendArray.push(whichOne);
        callBackArray.push(connID);
      }
    }

    redisPub.publish("CB:"+callBackID+":LST", JSON.stringify(callBackArray));
    for(var i=0; i<sendArray.length; i++){
      writeTo(sendArray[i], sendPacket);
    }

    // What happens if a connection drops in the middle of this process?
  }
  else{
    for(connID in groups[groupName]){
      whichOne = connections[connID];
      if (whichOne.connectionClass === "native"){
        writeTo(whichOne, sendPacket);
      }
    }
  }
}


function addCallBackConnections(callBackID, message){
  // console.log("ADDING CALL BACK CONNECTIONS", callBackID, message);
  communication.incomingCallBacks[callBackID].addConnections(JSON.parse(message));    
}


var makeCallBack = function(remote, who, packet, theCallBack, callBack){

  var packetReadyJSON = packet;
  var callBackID = null;

  if(typeof theCallBack === "function"){
    callBackID = makeUniqueCallBackID();
    communication.incomingCallBacks[callBackID] = new IncomingCallBack(theCallBack, callBackID, remote);
    packetReadyJSON.callBack = callBackID;
    packetReadyJSON.owner = processID;
  }

  if(typeof callBack === "function") callBack(who, JSON.stringify(packetReadyJSON), callBackID);

};


function makeUniqueCallBackID(){
  return helper.makeIdAlpha(12)+processID+(new Date().getTime());
}


// var callItBack = function (id, owner, args){

//   console.log("CALL IT BACK", this.id, id, owner, args);

//   if((owner === processID || !owner) || !config.options.redisStore ){

//     var theCallBack = communication.incomingCallBacks[id];
//     if(theCallBack !== undefined){
//       theCallBack.executeCallBack(this, args);
//       if(theCallBack.total <= 1){
//         theCallBack.destroyCallBack();
//         delete communication.incomingCallBacks[id];
//       }
//     }


//   }
//   else if(config.options.redisStore){
//     console.log("REDIS CALLIT BACK");
//     log.warn(process.pid, moduleName, "REDIS Callback", id, owner, this.id);
//     redisPub.publish("PRCCB:"+id, JSON.stringify( {connID:this.id, id: id, owner: owner, args: args} ) );
//   }
// };