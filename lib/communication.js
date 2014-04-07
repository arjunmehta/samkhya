/*!
 * argyleSocks - messaging Methods
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

var argyle;
var communication;

function Communication(){
  communication = this;

  this.outgoingCallBacks = {};        //outgoing callbacks are those sent from the host when it's done executing.
  this.incomingCallBacks = {};        //incoming callbacks are those sent from the client when it's done executing.
  this.incomingCallBacksCount = {};   //keeps track of how many callbacks have been returned from all the clients.
}


Communication.prototype.initialize = function (parent){
  argyle = parent;
};


Communication.prototype.sendTo = function (who, packet, callBack){
  argyle.comStore.sendTo(who, packet, callBack);
};


//COMMUNICATION CORE FUNCTIONS////////////////////////////////////////////////////////////////////////////
Communication.prototype.callItBack = function (id, owner, args){

  if((owner === processID || !owner) || !config.options.redisStore ){

    communication.incomingCallBacks[id].callBack.apply(this, args);
    communication.incomingCallBacksCount[id].executed++;

    if(communication.incomingCallBacksCount[id].executed == communication.incomingCallBacksCount[id].total){
      delete communication.incomingCallBacks[id];
      delete communication.incomingCallBacksCount[id];
    }
  }
  else if(config.options.redisStore){
    log.warn(process.pid, moduleName, "REDIS Callback", id, owner);
    argyle.redisPub.publish(owner+":callBack", JSON.stringify( {id: id, owner: owner, args: args} ) );
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


function loginConnection(whichOne, messageObj){

  var loginObject = JSON.parse(messageObj.login[1]) || null;
  var regTokenSalt = loginObject.tokenKey || null;
  var regToken = messageObj.login[0] || null;

  log.info(process.pid, moduleName, "messageObj.login", messageObj.login, loginObject);

  authentication.validateRegistrationToken(whichOne.id, regToken, regTokenSalt, function (err, reply){
    if(!err){

      whichOne.navInfo.sessionInfo = loginObject;

      log.info(process.pid, moduleName, "RECEIVING REQUEST TO LOGIN ArgyleSocks CONNECTION", loginObject);

      // generates a new token for the connection.
      // integrated check for session validity.
      authentication.initiateUserToken( connectionController.connections[whichOne.id], loginObject.sessionID, loginObject.userID, function (err, token, userID){

        if(err){
          log.error(process.pid, moduleName, "TOKEN ASSIGNMENT ERROR", err);
          communication.sendTo( whichOne.id, { func: "reportError", args: [187, err, "Invalid Token Initiation: Session either Expired or Invalid"] });
        }
        else if(!err && userID == loginObject.userID){

          log.info(process.pid, moduleName, "SENDING TOKEN TO", whichOne.id, userID, token);
          argyle.emit("connectionLoggedIn", whichOne, loginObject);

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
  // DO NOT Expose functions to Argyle that you don't want directly accessed by connected clients! Instead add functions and filter using authentication techniques.

  var func = messageObj.func;
  var ns = messageObj.ns || 'core';

  // var validFunction = ((typeof nameSpace[func] === "function") && ((ns !== "argyle") || (messageObj.specialKey === argyle.specialKey)));

  var nameSpace = argyle.nameSpaces[ns];
  var messageArgs = messageObj.args || [];

  if(typeof nameSpace[func] === "function" && (ns !== "argyle" || argyle.specialKey === messageObj.specialKey)){

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
    log.error("" + process.pid, moduleName, "ERROR: Call by client:", messageObj.sender, ":", func, "is not an exposed Argyle Object that can be executed via the client.");
  }
}


function createCallBack(id, sender, owner){

  var cid = id;
  var csender = sender;
  var cowner = owner;

  function theCallBack(){
    var args = Array.prototype.slice.call(arguments);
    communication.sendTo(csender, {func: "callItBack", args: [cid, cowner, args] } );
    delete communication.outgoingCallBacks[cid];
  }

  return theCallBack;
}
