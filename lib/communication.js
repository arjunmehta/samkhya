/*!
 * Samsaara - messaging Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = new Communication();

var path = require("path");
var log = require("./log.js");
var moduleName = path.basename(module.filename);

var processID = "" + process.pid;

var helper = require('./helper.js');
var config = require('./config.js');

var connectionController = require('./connectionController.js');
var authentication = require('./authentication.js');

var samsaara;
var communication;

function Communication(){
  communication = this;

  this.outgoingCallBacks = {};        //outgoing callbacks are those sent from the host when it's done executing.
  this.incomingCallBacks = {};        //incoming callbacks are those sent from the client when it's done executing.
  this.incomingCallBacksCount = {};   //keeps track of how many callbacks have been returned from all the clients.
}


Communication.prototype.initialize = function (parent){
  samsaara = parent;
};


Communication.prototype.sendTo = function (who, packet, callBack){
  samsaara.comStore.sendTo(who, packet, callBack);
};


Communication.prototype.sendToGroup = function (who, packet, callBack){
  samsaara.comStore.sendToGroup(who, packet, callBack);
};

//COMMUNICATION CORE FUNCTIONS////////////////////////////////////////////////////////////////////////////
Communication.prototype.callItBack = function (id, owner, args){

  // console.log("CALL IT BACK", this.id, id, owner);

  if((owner === processID || !owner) || !config.options.redisStore ){

    if(communication.incomingCallBacks[id] !== undefined){
      communication.incomingCallBacks[id].callBack.apply(this, args);
      communication.incomingCallBacksCount[id].executed++;

      if(communication.incomingCallBacksCount[id].executed === communication.incomingCallBacksCount[id].total){
        delete communication.incomingCallBacks[id];
        delete communication.incomingCallBacksCount[id];
      }
    }
    else{
      delete communication.incomingCallBacks[id];
      delete communication.incomingCallBacksCount[id];
    }

  }
  else if(config.options.redisStore){
    log.warn(process.pid, moduleName, "REDIS Callback", id, owner, this.id);
    samsaara.redisPub.publish(owner+":callBack", JSON.stringify( {connID:this.id, id: id, owner: owner, args: args} ) );
  }
};


Communication.prototype.receiveMsg = function (messageObj){

  var tokenMatch;

  if(this.id){
    messageObj.sender = this.id;
    tokenMatch = (this.token == messageObj.token) || (this.oldToken == messageObj.token);

    if(messageObj.opts){
      log.info(process.pid, moduleName, messageObj.opts);
      connectionController.initializeConnection(this.id, messageObj.opts);
    }
    if(messageObj.login){
      loginConnection(this, messageObj);
    }
    if(messageObj.interProcess === true){
      messageObj.sender = samsaara.specialKey;
    }
  }
  else{
    messageObj.sender = messageObj.owner;
    tokenMatch = true;
  }

  if(messageObj.func){
    if(tokenMatch){
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

  if(theCallBack && typeof theCallBack === "function"){

    var execFrom = this;
    var callBackID = helper.makeIdAlpha(12);

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

        if(err){
          log.error(process.pid, moduleName, "TOKEN ASSIGNMENT ERROR", err);
          communication.sendTo( whichOne.id, { func: "reportError", args: [187, err, "Invalid Token Initiation: Session either Expired or Invalid"] });
        }
        else if(!err && userID === loginObject.userID){

          log.info(process.pid, moduleName, "SENDING TOKEN TO", whichOne.id, userID, token);
          samsaara.emit("connectionLoggedIn", whichOne, loginObject);

          communication.sendTo( whichOne.id, { func: "updateToken", args: [whichOne.oldToken, token]}, function (token){
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


function executeFunction(whichOne, messageObj){

  // SAFE FUNCTIONAL EXECUTION
  // DO NOT Expose functions to Samsaara that you don't want directly accessed by connected clients! Instead add functions and filter using authentication techniques.

  var func = messageObj.func;
  var ns = messageObj.ns || 'core';

  // var validFunction = ((typeof nameSpace[func] === "function") && ((ns !== "samsaara") || (messageObj.specialKey === samsaara.specialKey)));

  var nameSpace = samsaara.nameSpaces[ns];
  var messageArgs = messageObj.args || [];

  if(typeof nameSpace[func] === "function" && (ns !== "samsaara" || samsaara.specialKey === messageObj.specialKey)){

    var callBackID = messageObj.callBack;
    if(typeof callBackID === "string" && callBackID.match(/^([a-zA-Z]+)$/)){
      // handle client callbacks via a callback id that is stored and sent back to the client with new arguments
      var theCallBack = communication.outgoingCallBacks[callBackID] = createCallBack(callBackID, messageObj.sender, messageObj.owner);
      theCallBack.id = callBackID; // for reference during forwarding
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

  var cid = id;
  var csender = sender;
  var cowner = owner;
  var theCallBack;

  if(sender !== samsaara.specialKey){
    theCallBack = function(){
      var args = Array.prototype.slice.call(arguments);
      communication.sendTo(csender, {func: "callItBack", args: [cid, cowner, args] } );
      delete communication.outgoingCallBacks[cid];
    };
  }
  else{
    theCallBack = function(){
      var args = Array.prototype.slice.call(arguments);
      // console.log(process.pid, cid, cowner, "////////////////////////CALLBACK", args);
      samsaara.redisPub.publish(owner, JSON.stringify( {func: "callItBack", args: [cid, cowner, args] }) );
      delete communication.outgoingCallBacks[cid];
    };
  }

  return theCallBack;
}
