/*!
 * Samsaara - grouping Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = new ContextController();

var path = require("path");
var log = require("./log.js");
var moduleName = path.basename(module.filename);

var helper = require("./helper.js");

var connectionController = require('./connectionController.js');

var SymbolicConnection = require('../models/symbolic.js');
var Context = require('../models/context.js');

var contextController;
var contexts;
var samsaara;

function ContextController(parent){
  contextController = this;
  contexts = this.contexts = {};
}

ContextController.prototype.initialize = function(parent){
  samsaara = parent;
  this.Context = Context;
};

//SHALLOW OPEN
var openContext = ContextController.prototype.openContext = function(contextID, callBack){

  isContextOpen(contextID, function(open){

    if(open === false){
      samsaara.client.hget("contextList", contextID, function(err, reply){
        var contextRow = JSON.parse(reply);

        contexts[contextID] = new Context(contextID);
        samsaara.client.hset("openContexts", contextID, process.pid);
        samsaara.redisSub.subscribe("CTX:" + contextID);

        if(callBack && typeof callBack === "function") callBack(contextID, contextRow);
        samsaara.emit("contextOpened", contextID);
      });
    }
    else{
      if(callBack && typeof callBack === "function") callBack(contextID, false);
    }
  });
};

//callBack(context)
var switchContext = ContextController.prototype.switchContext = function (connID, contextID, callBack){

  // When listing contexts, should there be some indication on the client whether that context is open or not?
  // if it's open elsewhere
  // create a symbolic connection on the context's host process (callBack executes confirmation)

  var whichOne = connectionController.connections[connID];
  var connectionOwner = whichOne.owner;
  var context = contexts[contextID];

  clearFromContext(connID, function (whichID){

    // if it doesn't exist locally, and if this process isn't even the owner, move the connection back to its owner
    if(context === undefined && connectionOwner !== process.pid){
      log.debug( process.pid, moduleName, "PROCESS != OWNER", connectionOwner, whichID);
      samsaara.comStore.sendToOwner(whichID, connectionOwner, {ns: "samsaara", func: "switchContext", args: [whichID, contextID], specialKey: samsaara.specialKey}, callBack);
    }

    // if it IS the owner, and the context doesn't exist locally, see if it exists (in the world). If it does, add the connection to it over there. If it doesn't, return false.
    else if(context === undefined){
      log.debug( process.pid, moduleName, "PROCESS == OWNER", connectionOwner, "but context hasn't been loaded locally", whichID);

      isContextOpen(contextID, function (open){
        if(open === true){
          // it's been opened somewhere else already... send to that place.
          addToForeignContext(whichOne, contextID, callBack);
        }
        else{
          if(callBack && typeof callBack === "function") callBack("Not Open", false);
        }
      });
    }
    else{
      log.debug( process.pid, moduleName, "PROCESS == OWNER", connectionOwner, "AND is LOCAL", whichID);
      addToLocalContext(contextID, whichOne, callBack);
    }
  });
};


var linkContext = ContextController.prototype.linkContext = function(contextID, toLinkTo, callBack){
  contexts[contextID] = toLinkTo;
  if(callBack && typeof callBack === "function") callBack(toLinkTo);
};



var updateContext = ContextController.prototype.updateContext = function(contextID, callBack){

  var projectData = contexts[contextID];

  samsaara.client.hset("contextList", contextID, projectData, function(err, reply){
    var contextRow = JSON.parse(reply);

    if(callBack && typeof callBack === "function") callBack(contextID, reply);
    samsaara.emit("contextUpdated", whichOne, contextID);
  });
};


var closeContext = ContextController.prototype.closeContext = function (contextID, callBack){

};


var isContextOpen = ContextController.prototype.isContextOpen = function(whichContext, callBack){

  log.debug( process.pid, moduleName, "CONTEXT EXISTS EXECUTED");

  samsaara.client.hexists("openContexts", whichContext, function (err, reply) {
    if(reply == "1"){
      if(callBack && typeof callBack === "function") callBack(true);
    }
    else{
      if(callBack && typeof callBack === "function") callBack(false);
    }    
  });
};


var addToForeignContext = ContextController.prototype.addToForeignContext = function(whichOne, whichContext, callBack){

  log.debug( process.pid, moduleName, "ADDING TO FOREIGN CONTEXT", whichContext);
  whichOne.foreignContext = whichContext;
  var connID = whichOne.id;
  var foreignMessage = { ns: "samsaara", func: "switchContext", args: [connID, whichContext], specialKey: samsaara.specialKey };
  
  // NOT SURE HOW SECURE THIS IS!! ie. Sending the connection's token to another process via Redis. Maybe Encrypt these types of messages
  var symbolic = {
    owner: process.pid,
    token: whichOne.token,
    nativeID: connID,
    navInfo: whichOne.navInfo,
    groups: whichOne.groups
  };

  samsaara.comStore.sendToContext(symbolic, whichContext, foreignMessage, callBack);
};



var clearFromContext = ContextController.prototype.clearFromContext = function (connID, callBack){

  var whichOne = connectionController.connections[connID];
  var contextID = whichOne.context;

  log.debug( process.pid, moduleName, "CLEAR CONTEXT MAIN/////////", connID);
  log.debug( process.pid, moduleName, "CLEAR CONTEXT contexts. foreignContext:", whichOne.foreignContext || false, ": PrimaryContext:", whichOne.context || false);

  if(contextID !== null && contexts[contextID] !== undefined){

    var context = contexts[contextID];
    var contextGroups = context.groups;

    for(var group in contextGroups){
      removeFromMap(connID, contextGroups[group]);
    }

    samsaara.emit("clearedFromContext", whichOne, contextID);
  }

  whichOne.context = null;
  whichOne.foreignContext = null;

  if(callBack && typeof callBack === "function") callBack(connID);
};


var addToLocalContext = ContextController.prototype.addToLocalContext = function (contextID, whichOne, callBack){

  var groups = whichOne.groups;
  var context = contexts[contextID];
  var contextGroups = context.groups;

  log.debug( process.pid, moduleName, "ADD TO CONTEXT", whichOne.id, whichOne.groups, context.projectData.projectName);

  whichOne.foreignContext = null;
  whichOne.context = contextID;

  for(var i=0; i<groups.length; i++){
    log.debug( process.pid, moduleName, "ADD TO MAP", whichOne.id, groups[i], context.projectData.projectName);
    addToMap(whichOne.id, contextGroups[groups[i]]);
  }

  if(callBack && typeof callBack === "function") callBack(false, context);
  samsaara.emit("addedToContext", whichOne, contextID);
};




////////////////////////////////////////////////////////////////////////////////////////////
function addToMap(connID, whichGroup){
  whichGroup[connID] = true;
}

function removeFromMap(connID, whichGroup){
  if(whichGroup[connID] !== undefined){
    delete whichGroup[connID];
  }
}


///////////////////////////////////////////////////////////////////////////////////////////////////////////
// HELPER FUNCTIONS

function contextGroupExists(whichOne, whichGroup){
  if(whichOne && whichOne.context && contexts[whichOne.context] && contexts[whichOne.context][whichGroup]){
    return true;
  }
  else{
    return false;
  }
}

function inContextGroup(whichOne, whichGroup){
  if(whichOne && whichOne.context && contexts[whichOne.context] && contexts[whichOne.context][whichGroup] && contexts[whichOne.context][whichGroup][whichOne.id]){
    return true;
  }
  else{
    return false;
  }
}