/*!
 * Samsaara - grouping Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = new Grouping();

var path = require("path");
var log = require("./log.js");
var moduleName = path.basename(module.filename);

var helper = require("./helper.js");
var connectionController = require('./connectionController.js');

var grouping;
var samsaara;

function Grouping(parent){
  grouping = this;
  this.groups = {
    everyone: {}
  };
}

Grouping.prototype.initialize = function(parent){
  samsaara = parent;
  samsaara.nameSpaces = { core: {} };
};

Grouping.prototype.createGroup = function (groupName, callBack){
  if(grouping.groups[groupName] === undefined){

    grouping.groups[groupName] = {};
    if(callBack && typeof callBack === "function") callBack(false, grouping.groups[groupName]);
  }
  else{
    if(callBack && typeof callBack === "function") callBack("Samsaara Error: Group Already Exists", false);
  }
};


Grouping.prototype.inGroup = function (whichOne, groupName){
  return ( grouping.groups[whichOne.id] !== undefined );
};


Grouping.prototype.addToGroup = function (connID, groupSet, callBack){

  var evaluatedGroups = {};

  var totalGroupCount = 1;
  var totalEval = 0;

  function _addToGroup(_groupName, _id){
    if(grouping.groups[_groupName][_id] === undefined || grouping.groups[_groupName][_id] === false){
      // grouping.groups[_groupName][_id] = connectionController.connections[_id];
      grouping.groups[_groupName][_id] = true;
      connectionController.connections[_id].groups.push(_groupName);

      log.info(process.pid, moduleName, _id, "added to:", _groupName);

      _evalCB(_groupName, true);
    }
  }

  function _evalCB(_groupName, granted){
    totalEval++;
    evaluatedGroups[_groupName] = granted;
    if(totalGroupCount === totalEval){
      if(callBack && typeof callBack === "function") callBack(evaluatedGroups);
    }
  }

  if(Array.isArray(groupSet)){
    totalGroupCount = groupSet.length;
    for(var i=0; i<groupSet.length; i++){
      _addToGroup(groupSet[i], connID);
    }
  }
  else if(typeof groupSet === 'object' && groupSet !== null){
    totalGroupCount = Object.keys(groupSet).length;
    for(var key in groupSet){
      _addToGroup(groupSet[key], connID);
    }
  }
  else{
    _addToGroup(groupSet, connID);
  }
};

Grouping.prototype.authenticateAddToGroup = function (connID, groupSet, callBack){

  var evaluatedGroups = {};
  var totalGroupCount = 1;
  var totalEval = 0;

  function _auth(_groupName, _id){
    var userName = connectionController.connections[_id].sessionInfo.userName;
    auth.hasGroupAccess(userName, _groupName, function (hasAccess){
      if(hasAccess === true){
        _addToGroup(_groupName, _id);
      }
      else{
        _evalCB(_groupName, false);
      }
    });
  }

  function _addToGroup(_groupName, _id){
    if(grouping.groups[_groupName][_id] === undefined || grouping.groups[_groupName][_id] === false){
      // grouping.groups[_groupName][_id] = connectionController.connections[_id];
      grouping.groups[_groupName][_id] = true;
      connectionController.connections[_id].groups.push(_groupName);

      log.info(process.pid, moduleName, _id, "added to:", _groupName);

      _evalCB(_groupName, true);
    }
  }

  function _evalCB(_groupName, granted){
    totalEval++;
    evaluatedGroups[_groupName] = granted;
    if(totalGroupCount === totalEval){
      if(callBack && typeof callBack === "function") callBack(evaluatedGroups);
    }
  }

  if(Array.isArray(groupSet)){
    totalGroupCount = groupSet.length;
    for(var i=0; i<groupSet.length; i++){
      _auth(groupSet[i], connID);
    }
  }
  else if(typeof groupSet === 'object' && groupSet !== null){
    totalGroupCount = Object.keys(groupSet).length;
    for(var key in groupSet){
      _auth(groupSet[key], connID);
    }
  }
  else{
    _auth(groupSet, connID);
  }
};



Grouping.prototype.removeFromGroup = function (connID, groupName){
  if(grouping.groups[groupName][connID] !== undefined){
    delete grouping.groups[groupName][connID];
  }
};

Grouping.prototype.createNamespace = function(namespace, surfaceToMain){

  if(samsaara.nameSpaces[namespace] === undefined){
    samsaara.nameSpaces[namespace] = {};
    if(surfaceToMain === true && samsaara[namespace] === undefined){
      samsaara[namespace] = samsaara.nameSpaces[namespace];
    }
  }
};

Grouping.prototype.removeNamespace = function(namespace){
  if(samsaara[namespace] !== undefined && samsaara[namespace] === samsaara.nameSpaces[namespace]){
    delete samsaara[namespace];
  }
  delete samsaara.nameSpaces[namespace];
};

Grouping.prototype.expose = function(set, ns){

  if(ns === undefined){
    ns = "core";
  }

  var nameSpace = samsaara.nameSpaces[ns];
  if(nameSpace === undefined){
    nameSpace = samsaara.nameSpaces[ns] = {};
  }

  if(typeof set === 'object' && set !== null){
    for(var func in set){
      nameSpace[func] = set[func];
    }
  }
};

Grouping.prototype.exposeNamespace = function(ns, as){
  if(!samsaara.nameSpaces[as]){
    samsaara.nameSpaces[as] = ns;
  }
  else{
    log.error("ERROR: Namespace", as, "Already Exists");
  }
};

