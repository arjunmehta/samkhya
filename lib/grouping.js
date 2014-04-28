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
var config = require("./config.js");

var connectionController = require('./connectionController.js');
var communication = require('./communication.js');

var groups;

function Grouping(){
  groups = this.groups = {
    everyone: {}
  };
}

Grouping.prototype.setRedisStore = function(){
  if(config.redisStore === true){
    groupStore = require('./grouping-redis');
  }
  else{
    groupStore = require('./grouping-memory');
  }
};

Grouping.prototype.createGroup = function (groupName, callBack){

  if(config.redisStore === true){
    config.redisClient.hsetnx("groups", groupName, 1, function (err, reply){
      // console.log("CREATED GROUP", groupName);
    });
    config.redisSub.subscribe("GRP:"+groupName);
  }

  if(groups[groupName] === undefined){
    groups[groupName] = {};
    if(typeof callBack === "function") callBack(false, groups[groupName]);
  }
  else{
    if(typeof callBack === "function") callBack("Samsaara Error: Group Already Exists", false);
  }
};

Grouping.prototype.inGroup = function (whichOne, groupName){
  return ( groups[whichOne.id] !== undefined );
};

Grouping.prototype.addToGroup = function (connID, groupSet, callBack){

  var evaluatedGroups = {};

  var totalGroupCount = 1;
  var totalEval = 0;

  function _addToGroup(_groupName, _id){
    if(groups[_groupName] !== undefined && (groups[_groupName][_id] === undefined || groups[_groupName][_id] === false)){
      // groups[_groupName][_id] = connectionController.connections[_id];
      groups[_groupName][_id] = true;
      connectionController.connections[_id].groups.push(_groupName);

      log.info(process.pid, moduleName, _id, "added to:", _groupName);

      _evalCB(_groupName, true);
    }
    else{
      log.warn(process.pid, moduleName, _id, "trying to join Group:", _groupName, ", but it does not exist!");
      communication.sendToClient( _id, { internal: "reportError", args: [567, "ERROR", "Invalid Group: " + _groupName] });
      _evalCB(_groupName, false);
    }    
  }

  function _evalCB(_groupName, granted){
    totalEval++;
    evaluatedGroups[_groupName] = granted;
    if(totalGroupCount === totalEval){
      if(typeof callBack === "function") callBack(evaluatedGroups);
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
    if(groups[_groupName][_id] === undefined || groups[_groupName][_id] === false){
      // groups[_groupName][_id] = connectionController.connections[_id];
      groups[_groupName][_id] = true;
      connectionController.connections[_id].groups.push(_groupName);

      log.info(process.pid, moduleName, _id, "added to:", _groupName);

      _evalCB(_groupName, true);
    }
  }

  function _evalCB(_groupName, granted){
    totalEval++;
    evaluatedGroups[_groupName] = granted;
    if(totalGroupCount === totalEval){
      if(typeof callBack === "function") callBack(evaluatedGroups);
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
  if(groups[groupName][connID] !== undefined){
    delete groups[groupName][connID];
  }
};


