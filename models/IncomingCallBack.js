/*!
 * samsaaraSocks - CallBack Constructor
 * Copyright(c) 2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = IncomingCallBack;

var helper = require('../lib/helper.js');
var config = require('../lib/config.js');

var incomingCallBacks = require('../lib/communication.js').incomingCallBacks;

var initOffset = 1000;

function IncomingCallBack(theCallBack, callBackID, processes){
  this.callBackID = callBackID;
  this.callBack = theCallBack;
  this.owner = process.pid;
  this.list = {};
  this.expiry = new Date().getTime()+3600000;
  this.total = totalInit(processes);
}


IncomingCallBack.prototype.addConnections = function(connArray){
  for(var i=0; i<connArray.length; i++){
    this.list[connArray[i]] = true;
  }
  this.total += connArray.length - initOffset;
};


IncomingCallBack.prototype.addConnection = function(connID){
  // console.log("ADDING WAITING CALLBACK CONNECTION", connID);
  this.list[connID] = true;
  this.total++;
};


IncomingCallBack.prototype.executeCallBack = function(executorID, executor, args){
  if(this.list[executorID] !== undefined){
    // console.log("CallBack Executing", this.callBackID, this.total, this.list);
    this.callBack.apply(executor, args);
    this.total--;
    delete this.list[executorID];
    this.evaluateDestroy();
  }
};


IncomingCallBack.prototype.callBackError = function(executorID, executor, args){
  if(this.list[executorID] !== undefined){
    // console.log("CallBack Error", this.callBackID, args);
    this.total--;
    delete this.list[executorID];
    this.evaluateDestroy();
  }
};


IncomingCallBack.prototype.evaluateDestroy = function(){
  console.log("CallBack Evaluate Destroy", this.callBackID, this.list);
  if(this.total <= 0){
    console.log("Deleting CallBack", this.callBackID);
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


