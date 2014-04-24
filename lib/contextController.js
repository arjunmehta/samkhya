/*!
 * Samsaara - grouping Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = new ContextController();

var path = require("path");
var moduleName = path.basename(module.filename);

var helper = require("./helper.js");
var log = require("./log.js");
var config = require("./config.js");

var connectionController = require('./connectionController.js');

var SymbolicConnection = require('../models/symbolic.js');
var Context = require('../models/context.js');
var Access = require('../models/access.js');

var contextController,
    contexts,
    samsaara,
    redisStore = false;

function ContextController(parent){
  contextController = this;
  contexts = this.contexts = {};
}

ContextController.prototype.initialize = function(parent){
  samsaara = parent;
  this.Context = Context;
  this.Access = Access;
};

ContextController.prototype.setRedisStore = function(){
  if(config.options.redisStore){
    redisStore = true;    
  }
};

//TO DO
// Close Context
// Leave Context
// Multiple Contexts

//SHALLOW OPEN


var openContextWithData = ContextController.prototype.openContextWithData = function(contextID, contextData, options, callBack){

  if(typeof options === "function" && callBack === undefined){
    callBack = options;
    options = {};
  }

  isContextOpen(contextID, function (open, local){

    if(open === false){

      if(redisStore === true){

        createContext(contextID, contextData, options.access);

        samsaara.client.hset("openContexts", contextID, process.pid);
        samsaara.redisSub.subscribe("CTX:" + contextID);
        samsaara.emit("openedContext", contexts[contextID]);       
      }
      else{
        createContext(contextID, contextData, options.access);
        samsaara.emit("openedContext", contexts[contextID]);
      }

      if(callBack && typeof callBack === "function") callBack(null, contextID, contexts[contextID]);

    }
    else{
      if(callBack && typeof callBack === "function") callBack("ERR: " + contextID + " already open", contextID, null);
    }

  });
};


function createContext(contextID, contextData, access){
  contexts[contextID] = new Context(contextID);
  contexts[contextID].contextData = contextData || {};
  if(access !== undefined){            
    contexts[contextID].access = new Access(access.owner, access.read, access.write, access.readGroups, access.writeGroups);
  }
}

var openContext = ContextController.prototype.openContext = function(contextID, callBack){

    isContextOpen(contextID, function (open, local){

      var done;
      if(open === false){

        if(redisStore === true){
          done = function(contextID, contextData){
            contexts[contextID] = new Context(contextID);
            contexts[contextID].contextData = contextData;

            samsaara.client.hset("openContexts", contextID, process.pid);
            samsaara.redisSub.subscribe("CTX:" + contextID);
            samsaara.emit("openedContext", contexts[contextID]);
          };          
        }
        else{
          done = function(contextID, contextData){
            contexts[contextID] = new Context(contextID);
            contexts[contextID].contextData = contextData;

            samsaara.emit("openedContext", contexts[contextID]);
          };
        }

        if(callBack && typeof callBack === "function") callBack(null, contextID, done);

      }
      else{
        done = function(contextID){
          console.log("ERR: " + contextID + "already open");
        };        
        if(callBack && typeof callBack === "function") callBack("ERR: " + contextID + "already open", contextID, done);
      }

    });

};

//callBack(context)
// var switchContext = ContextController.prototype.switchContext = function (connID, contextID, callBack){

//   // When listing contexts, should there be some indication on the client whether that context is open or not?
//   // if it's open elsewhere
//   // create a symbolic connection on the context's host process (callBack executes confirmation)

//   var whichOne = connectionController.connections[connID];
//   var connectionOwner = whichOne.owner;
//   var context = contexts[contextID];

//   clearFromContext(connID, function (whichID){

//     if(redisStore === true){
//         // if it doesn't exist locally, and if this process isn't even the owner, move the connection back to its owner

//         if(context === undefined && connectionOwner !== process.pid){
//           log.debug( process.pid, moduleName, "PROCESS != OWNER", connectionOwner, whichID);
//           samsaara.comStore.sendToOwner(whichID, connectionOwner, {ns: "samsaara", func: "switchContext", args: [whichID, contextID], specialKey: samsaara.specialKey}, callBack);
//         }

//         // if it IS the owner, and the context doesn't exist locally, see if it exists (in the world). If it does, add the connection to it over there. If it doesn't, return false.
//         else if(context === undefined){
//           log.debug( process.pid, moduleName, "PROCESS == OWNER", connectionOwner, "but context hasn't been loaded locally", whichID);

//           isContextOpen(contextID, function (open){
//             if(open === true){
//               // it's been opened somewhere else already... send to that place.
//               addToForeignContext(whichOne, contextID, callBack);
//             }
//             else{
//               if(callBack && typeof callBack === "function") callBack("Not Open", false);
//             }
//           });
//         }
//         else{
//           log.debug( process.pid, moduleName, "PROCESS == OWNER", connectionOwner, "AND is LOCAL", whichID);
//           addToLocalContext(contextID, whichOne, callBack);
//         }
//     }
//     else{

//       isContextOpen(contextID, function (open){
//         if(open === true){        
//           log.debug( process.pid, moduleName, "PROCESS == OWNER", connectionOwner, "AND is LOCAL", whichID);
//           addToLocalContext(contextID, whichOne, callBack);
//         }
//         else{
//           if(callBack && typeof callBack === "function") callBack("Not Open", false);
//         }
//       });
//     }

//   });
// };


var switchContext = ContextController.prototype.switchContext = function (connID, contextID, callBack){

  var whichOne = connectionController.connections[connID];
  var connectionOwner = whichOne.owner;
  var context = contexts[contextID];

  clearFromContext(connID, function (whichID){

    if(context === undefined && connectionOwner !== process.pid){
      console.log( process.pid, moduleName, "PROCESS != OWNER", connectionOwner, whichID);
      samsaara.comStore.sendToOwner(whichID, connectionOwner, {ns: "samsaara", func: "switchContext", args: [whichID, contextID], specialKey: samsaara.specialKey}, callBack);
    }
    else{

      isContextOpen(contextID, function (open, local){

        if(open === true){
           console.log( process.pid, "CONTEXT IS OPEN");

          if(local === true){
            console.log(process.pid, "ATTEMPTING TO ADD TO LOCAL CONTEXT");
            addToLocalContext(whichOne, contextID, callBack);
          }
          else{
            console.log(process.pid, "ATTEMPTING TO ADD TO FOREIGN CONTEXT");
            addToForeignContext(whichOne, contextID, callBack);
          }
        }
        else{
          if(callBack && typeof callBack === "function") callBack("Context Not Open", false);
        }

      });
    }
  });

};

//////// TEST
function removeFromContext(){

}


var isContextOpen = ContextController.prototype.isContextOpen = function(contextID, callBack){

  var context = contexts[contextID];

  if(context === undefined){

    if(redisStore === true){
      // console.log("CHECKING REDIS STORE IF CONTEXT IS OPEN");
      samsaara.client.hexists("openContexts", contextID, function (err, reply) {
        // console.log("REDIS REPLY", err, reply);
        if(reply == "1"){
          if(callBack && typeof callBack === "function") callBack(true, false);
        }
        else{
          if(callBack && typeof callBack === "function") callBack(false, false);
        }    
      });
    }
    else{
       if(callBack && typeof callBack === "function") callBack(false, false);
    }
  }
  else{
    if(callBack && typeof callBack === "function") callBack(true, true);
  }

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


// var isContextOpen = ContextController.prototype.isContextOpen = function(whichContext, callBack){

//   log.debug( process.pid, moduleName, "CONTEXT EXISTS EXECUTED");

//   if(redisStore === true){
//     samsaara.client.hexists("openContexts", whichContext, function (err, reply) {
//       if(reply == "1"){
//         if(callBack && typeof callBack === "function") callBack(true);
//       }
//       else{
//         if(callBack && typeof callBack === "function") callBack(false);
//       }    
//     });
//   }
//   else{
//     if(contexts[whichContext] !== undefined){
//       if(callBack && typeof callBack === "function") callBack(true);
//     }
//     else{
//       if(callBack && typeof callBack === "function") callBack(false);
//     }
//   }

// };


var addToForeignContext = ContextController.prototype.addToForeignContext = function(whichOne, whichContext, callBack){

  console.log( process.pid, moduleName, "ADDING TO FOREIGN CONTEXT", whichContext, callBack);
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
  // this is so specific. This should be a much more general method/set of messages. createSymbolicOn(),
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

    samsaara.emit("removedFromContext", whichOne, contextID);
  }

  whichOne.context = null;
  whichOne.foreignContext = null;

  if(callBack && typeof callBack === "function") callBack(connID);
  
};


var addToLocalContext = ContextController.prototype.addToLocalContext = function (whichOne, contextID, callBack){

  var groups = whichOne.groups;
  var context = contexts[contextID];
  var contextGroups = context.groups;

  log.debug( process.pid, moduleName, "ADD TO CONTEXT", whichOne.id, whichOne.groups, context.contextID);

  whichOne.foreignContext = null;
  whichOne.context = contextID;

  for(var i=0; i<groups.length; i++){
    log.debug( process.pid, moduleName, "ADD TO MAP", whichOne.id, groups[i], context.contextID);
    if(contextGroups[groups[i]] === undefined){
      contextGroups[groups[i]] = {};
    }
    addToMap(whichOne.id, contextGroups[groups[i]]);
  }

  if(callBack && typeof callBack === "function") callBack(false, contextID);
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