/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = new Communication();

var path = require("path");
var moduleName = path.basename(module.filename);
var processID = "" + process.pid;

var helper = require('./helper.js');
var log = require("./log.js");

var samsaara = require('../index.js');
var config = require('./config.js');
var connectionController = require('./connectionController.js');
var authentication = require('./authentication.js');

var comStore,
    nameSpaces,
    outgoingCallBacks,
    incomingCallBacks;

var sendTo,
    sendToClient,
    sendToGroup;


function Communication(){
  outgoingCallBacks = this.outgoingCallBacks = {};        //outgoing callbacks are those sent from the host when it's done executing.
  incomingCallBacks = this.incomingCallBacks = {};        //incoming callbacks are those sent from the client when it's done executing.
  nameSpaces = this.nameSpaces = { core: {}, internal: {} };
}

Communication.prototype.setRedisStore = function (){
  if(config.redisStore === true){
    comStore = require('./communication-redis');
  }
  else{
    comStore = require('./communication-memory');
  }

  sendTo = comStore.sendTo;
  sendToClient = comStore.sendToClient;
  sendToGroup = comStore.sendToGroup;
  this.sendToContext = comStore.sendToContext;
  this.sendToOwner = comStore.sendToOwner;
  this.newConnection = comStore.newConnection;
  this.closeConnection = comStore.closeConnection;
};


Communication.prototype.sendToGroup = function(who, packet, theCallBack){  
  sendToGroup(who, packet, theCallBack);
};

Communication.prototype.sendToClient = function(who, packet, theCallBack){
  sendToClient(who, packet, theCallBack);
};

Communication.prototype.sendTo = function (who, packet, theCallBack){
  sendTo(who, packet, theCallBack);
};


Communication.prototype.router = function(whichOne, message){

  // console.log("ROUTER GETTING CALLED?");

  // Raw Messages
  // H (heartBeat)

  // JSON Pre-examination (before spending effort parsing)... 3rd character of JSON messages
  // C (callBack) ["C", "connectionToken", "callBackID", [arg1, arg2], "owner"]
  // F (function) ["F", "connectionToken", "functionName", [arg1, arg2], "callBackID"]
  // N (function in a reserved namespace) ["N", "connectionToken", "nameSpaceName", "functionName", [arg1, arg2], "callBackID"]
  // D (forced Direct Function Call) ["D", "connectionToken", "functionName", [arg1, arg2], "callBackID"]
  // P (publish/broadcast) Used to send messages to a specified channel that connections can subscribe to (not yet part of samsaara)

  // Operational (process-to-process communication), NEEDS TO BE ANOTHER FUNCTION
  // S (symbolic forward to native connection) ??
  // O (operational) ??

  // console.log(config.uuid, "INCOMING MESSAGE", message);

  if(message === 'H'){
    // console.log("Heartbeat...", whichOne.id);
    whichOne.lastHeartBeat = new Date().getTime();
  }
  else{
    var route = message.substr(2,8);
    // console.log(config.uuid, "MESSAGE ROUTE", route);
    if(route === config.uuid){   
      parseAndReceiveSub(whichOne, message);
    }
    else{
      console.log("TRYING TO ROUTE MESSAGE TO", "PRC:"+route+":RCV:"+whichOne.id);
      config.redisPub.publish("PRC:"+route+":RCV:"+whichOne.id+":"+whichOne.token, message);
    }    
  }
};

function parseAndReceive(whichOne, message){
  try{
    var parsedMessage = JSON.parse(message);
    receiveMsg.call( whichOne, parsedMessage );
  }
  catch(e){
    log.error("MESSAGE ERROR: INVALID JSON", message, e);
  }
}

function parseAndReceiveSub(whichOne, message){
  try{
    var parsedMessage = JSON.parse(message);
    receiveMsg.call( whichOne, parsedMessage[1] );
  }
  catch(e){
    log.error("MESSAGE ERROR: INVALID JSON", message, e);
  }
}



var receiveMsg = Communication.prototype.receiveMsg = function (messageObj, token){

  var tokenMatch;

  if(token === undefined){
    tokenMatch = (this.token === messageObj.token) || (this.oldToken === messageObj.token);
  }
  else{
    tokenMatch = (token === messageObj.token);
  }

  if(this.id !== undefined && tokenMatch === true){
    
    messageObj.sender = this.id;

    if(messageObj.func !== undefined){
      executeFunction(this, messageObj);
    }
    else if(messageObj.internal !== undefined){
      messageObj.ns = "internal";
      messageObj.func = messageObj.internal;
      executeFunction(this, messageObj);
    }
    else if(messageObj.opts !== undefined){
      log.info(process.pid, moduleName, messageObj.opts);
      // connectionController.initializeConnection(this.id, messageObj.opts);
      this.initialize(messageObj.opts);
    }
    else if(messageObj.login !== undefined){
      loginConnection(this, messageObj);
    }
  }
  else{
    console.log(process.pid, moduleName, process.pid, "ERROR: Token Mismatch:", this.token, messageObj.token);
  }

};

//COMMUNICATION CORE FUNCTIONS////////////////////////////////////////////////////////////////////////////
Communication.prototype.callItBack = function (id, owner, args){

  var theCallBack = incomingCallBacks[id];
  if(theCallBack !== undefined){
    // console.log("CALL IT BACK", this.id, id, owner, args, theCallBack);
    theCallBack.executeCallBack(this, args);
  }
  else{
    config.redisPub.publish("CB:"+id+":PRC", JSON.stringify( {connID:this.id, id: id, owner: owner, args: args} ) );
    config.redisSub.punsubscribe("CB:"+id+"*");
  }
};

Communication.prototype.callItBackError = function (id, owner, args){

  console.log(process.id, moduleName, this.id, "CallBack Error Function Handler", id, owner, args);
  var theCallBack = incomingCallBacks[id];
  if(theCallBack !== undefined){
    // console.log("BEFORE CALL IT BACK Error", this.id, id, owner, args, theCallBack);
    theCallBack.callBackError(this, args);
    // console.log("AFTER CALL IT BACK Error", this.id, id, owner, args, theCallBack);
  }
  else{
    config.redisPub.publish("CB:"+id+":ERR", JSON.stringify( {connID:this.id, id: id, owner: owner, args: args} ) );
    config.redisSub.punsubscribe("CB:"+id+"*");
  }
};




/**
 * Main Communication and Callback Methods
 */

//creates a record of the callBack to EXECUTE ON THE CLIENT SITE
// Communication.prototype.makeCallBack = function(numberOfClients, who, packet, theCallBack, callBack){
//   var packetReadyJSON = packet;

//   if(typeof theCallBack === "function"){

//     var execFrom = this;
//     var callBackID = helper.makeIdAlpha(12);

//     incomingCallBacks[callBackID] = {
//       callBack: theCallBack,
//       from: execFrom,
//       total: numberOfClients,
//       executed: 0
//     };

//     incomingCallBacksCount[callBackID] = {
//       total: numberOfClients,
//       executed: 0
//     };

//     packetReadyJSON.callBack = callBackID;
//     packetReadyJSON.owner = processID;
//   }

//   if(typeof callBack === "function"){
//     callBack(who, JSON.stringify(packetReadyJSON) );
//   }
// };


Communication.prototype.writeTo = function(conn, packetReady){
  conn.write( packetReady );
};


function loginConnection(whichOne, messageObj){

  var loginObject = JSON.parse(messageObj.login[1]) || null;
  var regTokenSalt = loginObject.tokenKey || null;
  var regToken = messageObj.login[0] || null;

  log.info(process.pid, moduleName, "messageObj.login", messageObj.login, loginObject);

  authentication.validateRegistrationToken(whichOne.id, regToken, regTokenSalt, function (err, reply){
    if(err === null){

      whichOne.navInfo.sessionInfo = loginObject;

      log.info(process.pid, moduleName, "RECEIVING REQUEST TO LOGIN Samsaara CONNECTION", loginObject);

      // generates a new token for the connection.
      // integrated check for session validity.
      authentication.initiateUserToken( connectionController.connections[whichOne.id], loginObject.sessionID, loginObject.userID, function (err, token, userID){

        if(err !== null){
          log.error(process.pid, moduleName, "TOKEN ASSIGNMENT ERROR", err);
          sendToClient( whichOne.id, { internal: "reportError", args: [187, err, "Invalid Token Initiation: Session either Expired or Invalid"] });
        }
        else if(err === null && userID === loginObject.userID){

          log.info(process.pid, moduleName, "SENDING TOKEN TO", whichOne.id, userID, token);
          config.emit("connectionLoggedIn", whichOne, loginObject);

          sendToClient( whichOne.id, { internal: "updateToken", args: [whichOne.oldToken, token]}, function (token){
            // 'this' is now the one returning the callBack.
            log.info(process.pid, moduleName, "DELETING OLD TOKEN for", this.id, this.oldToken, token);
            this.oldToken = null;
          });
        }
      });
    }
    else{
      log.error(process.pid, moduleName, "CONNECTION LOGIN ERROR:", err);
    }
  });
}


Communication.prototype.createNamespace = function(namespace, surfaceToMain){
  if(nameSpaces[namespace] === undefined){
    nameSpaces[namespace] = {};
    if(surfaceToMain === true && samsaara[namespace] === undefined){
      samsaara[namespace] = nameSpaces[namespace];
    }
  }  
};

Communication.prototype.removeNamespace = function(namespace){  
  if(samsaara[namespace] !== undefined && samsaara[namespace] === nameSpaces[namespace] && namespace !== "core" && namespace !== "samsaara"){
    delete samsaara[namespace];
    delete nameSpaces[namespace];
  }  
};

Communication.prototype.expose = function(set, ns){

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

Communication.prototype.exposeNamespace = function(ns, as){
  if(nameSpaces[as] === undefined){
    nameSpaces[as] = ns;
  }
  else{
    log.error("ERROR: Namespace", as, "Already Exists or is Protected");
  }
};


function executeFunction(whichOne, messageObj){

  var func = messageObj.func;
  var ns = messageObj.ns || 'core';
  var nameSpace = nameSpaces[ns];
  var messageArgs = messageObj.args || [];

  

  if(typeof nameSpace[func] === "function" && (ns !== "samsaara" || config.specialKey === messageObj.specialKey)){

    // console.log("EXECUTING FUNCTION", whichOne.id, JSON.stringify(messageObj));

    var callBackID = messageObj.callBack;
    if(typeof callBackID === "string" && callBackID.match(/^([a-zA-Z]+)$/)){
      var theCallBack = outgoingCallBacks[callBackID] = createCallBack(callBackID, messageObj.sender, messageObj.owner);
      theCallBack.id = callBackID;
      messageArgs.push(theCallBack);
    }
    nameSpace[func].apply(whichOne, messageArgs);
  }
  else{
    log.error("" + process.pid, moduleName, "ERROR: Call by client:", messageObj.sender, ":", func, "is not an exposed Samsaara Object that can be executed via the client.");
  }
}

//creates a callBack to that is EXECUTED ON THE SERVER SIDE with arguments from the client
function createCallBack(id, sender, owner){

  console.log("CREATING CALLBACK");

  var theCallBack;

  if(sender !== config.specialKey){
    theCallBack = function(){
      var args = Array.prototype.slice.call(arguments);
      // if(typeof args[args.length-1] === "function"){
      //     console.log("THIS CALL BACK HAS A CALLBACK! WOW");
      //     var theOtherCallBack = args.pop();
      //     makeCallBack(false, {internal: "callItBack", args: [id, owner, args] }, theOtherCallBack, function(callBackID, packetReady){
      //       sendToClient(sender, packetReady);
      //       delete outgoingCallBacks[id];
      //     });
      // }
      // else{
        sendToClient(sender, {internal: "callItBack", args: [id, owner, args] } );
        delete outgoingCallBacks[id];
      // }

    };
  }
  else{
    theCallBack = function(){
      var args = Array.prototype.slice.call(arguments);
      console.log(process.pid, cid, cowner, "INTERNAL PROCESS ////////////////////////CALLBACK", args);
      config.redisPub.publish("PRC:"+owner, JSON.stringify( {internal: "callItBack", args: [id, owner, args] }) );
      delete outgoingCallBacks[id];
    };
  }

  return theCallBack;
}


// function makeCallBack(pattern, packetJSON, theCallBack, callBack){

//   var callBackID = null;

//   if(typeof theCallBack === "function"){  
//     callBackID = makeUniqueCallBackID();
//     // if(pattern !== null){
//       communication.incomingCallBacks[callBackID] = new IncomingCallBack(theCallBack, callBackID, remote);
//       packetJSON.callBack = callBackID;
//       packetJSON.owner = config.uuid;
//     // }
//   }

//   if(typeof callBack === "function") callBack(callBackID, JSON.stringify([config.uuid, packetJSON]));

// }

// function makeUniqueCallBackID(){
//   return helper.makeIdAlpha(12)+processID+(new Date().getTime());
// }
