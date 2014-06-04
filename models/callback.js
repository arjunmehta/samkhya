/*!
 * samsaaraSocks - CallBack Constructor
 * Copyright(c) 2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var debugManagement = require('debug')('samsaara:callback:management');
var debugConnections = require('debug')('samsaara:callback:connections');


var core;
var incomingCallBacks;
var initOffset = 1000;


function initialize(samsaaraCore){

  debugManagement("Initializing CallBacks", samsaaraCore.communication.incomingCallBacks);

  core = samsaaraCore;  
  incomingCallBacks = samsaaraCore.communication.incomingCallBacks;

  return IncomingCallBack;
}


function IncomingCallBack(theCallBack, callBackID, processes){
  this.id = this.callBackID = callBackID;
  this.callBack = theCallBack;
  this.list = {};
  this.total = totalInit(processes);
}


IncomingCallBack.prototype.addConnections = function(connArray){
  debugConnections("Adding Waiting Callback Connections", this.callBackID, connArray);
  for(var i=0; i<connArray.length; i++){
    this.list[connArray[i]] = true;
  }
  this.total += connArray.length - initOffset;
};


IncomingCallBack.prototype.addConnection = function(connID){
  debugConnections("Adding Waiting Callback Connection", this.callBackID, connID);
  this.list[connID] = true;
  this.total++;
};


IncomingCallBack.prototype.executeCallBack = function(executorID, executor, args){
  if(this.list[executorID] !== undefined){
    // debug("CallBack Executing", this.callBackID, this.total, this.list);
    this.callBack.apply(executor, args);
    this.total--;
    this.list[executorID] = undefined;
    this.evaluateDestroy();
  }
};


IncomingCallBack.prototype.callBackError = function(executorID, executor, args){
  if(this.list[executorID] !== undefined){
    // debug("CallBack Error", this.callBackID, args);
    this.total--;
    this.list[executorID] = undefined;
    this.evaluateDestroy();
  }
};


IncomingCallBack.prototype.evaluateDestroy = function(){
  debugManagement("CallBack Evaluate Destroy", this.callBackID, this.list);
  if(this.total <= 0){
    debugManagement("Deleting CallBack", this.callBackID);
    this.destroy();
  }
};


IncomingCallBack.prototype.destroy = function(){
  delete incomingCallBacks[this.callBackID];
};


function totalInit(processes){
  if(processes > 0){
    return processes*initOffset; // could be set initially to numProceses * 1000
  }
  else{
    return 0;
  }
}


exports = module.exports = {
  initialize: initialize,
  IncomingCallBack: IncomingCallBack
};
