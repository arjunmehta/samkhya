/*!
 * samsaaraSocks - Context Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var helper = require('../lib/helper.js');
var samsaara;

exports = module.exports = Context;

function Context(contextID){
  this.contextID = contextID || null;
  this.groups = { everyone: {} };
  this.access = { owner: true, read: {}, write: {}, readGroups:{}, writeGroups:{} };
}

Context.prototype = {
  contextID: "",
  access: {}
};

exports.initialize = function(parent){
  samsaara = parent;
};

Context.prototype.assignID = function(contextID){
  this.contextID = contextID;
};

Context.prototype.resetGroups = function(groups){
  this.groups = { everyone: {} };
  for(var group in groups){
    this.groups[group] = groups[group];
  }
};

Context.prototype.resetPermissions = function(permissions){
  this.access = { owner: true, read: {}, write: {}, readGroups:{}, writeGroups:{} };
  for(var priviledge in permissions){
    this.access[priviledge] = permissions[priviledge];
  }
};

// SendToGroup, addCustomGroup, addToGroup, addAccess

Context.prototype.sendTo = function(groupName, message, callBack){
  var group = this.groups[groupName];
  samsaara.sendTo(group, message, callBack);
};

Context.prototype.addGroup = function(groupName){
  if(!this.groups[groupName]){
    this.groups[groupName] = {};
  }
};

Context.prototype.addToGroup = function(connID, groupName){
  if(this.groups[groupName]){
    this.groups[groupName][connID] = true;
  }  
};

Context.prototype.removeFromGroup = function(connID, groupName){
  if(this.groups[groupName]){
    delete this.groups[groupName][connID];
  }  
};

Context.prototype.removeConnection = function(connID){
  var groups = this.groups;
  for(var group in groups){
    if(groups[group][connID] !== undefined){
      delete groups[group][connID];
    }
  }

  samsaara.emit("clearedFromContext", samsaara.connections[connID], this.contextID);
};


Context.prototype.addAccess = function(userName, privilege){
  if(this.access[privilege] !== undefined){
    this.access[privilege][userName] = true;
  }
};


Context.prototype.authenticate = function(whichOne, forWhat, includeGroups){
  if(this.access[forWhat][whichOne.sessionInfo.userID] !== undefined){
    return true;
  }
  else if(includeGroups === true){
    var forWhatGroups = this.access[forWhat + "Groups"];
    var userGroups = whichOne.groups;
    for(var i = 0; i< userGroups.length; i++){
      if(forWhatGroups[userGroups[i]] !== undefined){
        return true;
      }
    }
    return false;
  }
  else{
    return false;
  }
};

Context.prototype.hasReadAccess = function(whichOne){
  return this.authenticate(whichOne, "read");
};
Context.prototype.hasWriteAccess = function(whichOne){
  return this.authenticate(whichOne, "write");
};


Context.prototype.isOwner = function(whichOne){
  if(this.access.owner === whichOne.sessionInfo.userID){
    return true;
  }
  else{
    return true;
  }  
};

