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
    // comStore.initialize();
  }
  else{
    comStore = require('./communication-memory');
  }

  sendTo = comStore.sendTo;
  sendToClient = comStore.sendToClient;
  sendToGroup = comStore.sendToGroup;
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


//COMMUNICATION CORE FUNCTIONS////////////////////////////////////////////////////////////////////////////
Communication.prototype.callItBack = function (id, owner, args){

  if((owner === processID || !owner) || config.redisStore === false ){
    // console.log("CALL IT BACK", this.id, id, owner, args);

    var theCallBack = incomingCallBacks[id];
    if(theCallBack !== undefined){
      theCallBack.executeCallBack(this, args);
    }
  }
  else if(config.redisStore === true){
    log.warn(process.pid, moduleName, "SENDING Redis Callback", id, owner, this.id);
    config.redisPub.publish("CB:"+id+":PRC", JSON.stringify( {connID:this.id, id: id, owner: owner, args: args} ) );
  }
};

Communication.prototype.callItBackError = function (id, owner, args){

  if((owner === processID || !owner) || config.redisStore === false ){
    console.log("CallBack Error Function Handler", this.id, id, owner, args);

    var theCallBack = incomingCallBacks[id];
    if(theCallBack !== undefined){
      theCallBack.callBackError(this, args);
    }

  }
  else if(config.redisStore === true){
    console.log(process.pid, moduleName, "SENDING Redis Callback Error", id, owner, this.id);
    config.redisPub.publish("CB:"+id+":ERR", JSON.stringify( {connID: this.id, id: id, owner: owner, args: args} ) );
  }
};


Communication.prototype.receiveMsg = function (messageObj){

  var tokenMatch;

  if(this.id !== undefined){
    messageObj.sender = this.id;
    tokenMatch = (this.token === messageObj.token) || (this.oldToken === messageObj.token);

    if(messageObj.opts !== undefined){
      log.info(process.pid, moduleName, messageObj.opts);
      connectionController.initializeConnection(this.id, messageObj.opts);
    }
    if(messageObj.login !== undefined){
      loginConnection(this, messageObj);
    }
    if(messageObj.interProcess === true){
      messageObj.sender = config.specialKey;
    }
  }
  else{
    messageObj.sender = messageObj.owner;
    tokenMatch = true;
  }

  if(messageObj.func !== undefined){
    if(tokenMatch === true){
      executeFunction(this, messageObj);
    }
    else{
      log.error(process.pid, moduleName, process.pid, "ERROR: Token Mismatch:", this.token, messageObj.token);
    }
  }

  if(messageObj.internal !== undefined){
    if(tokenMatch === true){
      messageObj.ns = "internal";
      messageObj.func = messageObj.internal;
      executeFunction(this, messageObj);
    }
    else{
      log.error(process.pid, moduleName, process.pid, "ERROR: Token Mismatch:", this.token, messageObj.token);
    }
  }
};




/**
 * Main Communication and Callback Methods
 */

//creates a record of the callBack to EXECUTE ON THE CLIENT SITE
Communication.prototype.makeCallBack = function(numberOfClients, who, packet, theCallBack, callBack){
  var packetReadyJSON = packet;

  if(typeof theCallBack === "function"){

    var execFrom = this;
    var callBackID = helper.makeIdAlpha(12);

    incomingCallBacks[callBackID] = {
      callBack: theCallBack,
      from: execFrom,
      total: numberOfClients,
      executed: 0
    };

    incomingCallBacksCount[callBackID] = {
      total: numberOfClients,
      executed: 0
    };

    packetReadyJSON.callBack = callBackID;
    packetReadyJSON.owner = processID;
  }

  if(typeof callBack === "function"){
    callBack(who, JSON.stringify(packetReadyJSON) );
  }
};


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

  var theCallBack;

  if(sender !== config.specialKey){
    theCallBack = function(){
      var args = Array.prototype.slice.call(arguments);
      sendToClient(sender, {internal: "callItBack", args: [id, owner, args] } );
      delete outgoingCallBacks[id];
    };
  }
  else{
    theCallBack = function(){
      var args = Array.prototype.slice.call(arguments);
      // console.log(process.pid, cid, cowner, "////////////////////////CALLBACK", args);
      config.redisPub.publish("PRC:"+owner, JSON.stringify( {internal: "callItBack", args: [id, owner, args] }) );
      delete outgoingCallBacks[id];
    };
  }

  return theCallBack;
}
