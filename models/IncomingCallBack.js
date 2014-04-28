/*!
 * samsaaraSocks - CallBack Constructor
 * Copyright(c) 2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = IncomingCallBack;

var helper = require('../lib/helper.js');
var config = require('../lib/config.js');

var redisSub = config.redisSub;
var incomingCallBacks = require('../lib/communication.js').incomingCallBacks;

function IncomingCallBack(theCallBack, callBackID, remote){
  this.callBackID = callBackID;
  this.callBack = theCallBack;
  this.owner = process.pid;
  this.list = {};
  this.expiry = new Date().getTime()+3600000;

  if(remote === true){
    this.total = 6*1000; // could be set initially to numProceses * 1000
  }
  else{
    this.total = 0;
  }
  redisSub.psubscribe("CB:"+callBackID+"*");
}

IncomingCallBack.prototype.addConnections = function(connArray){
  for(var i=0; i<connArray.length; i++){
    this.list[connArray[i]] = true;
  }
  this.total += connArray.length - 1000;
};

IncomingCallBack.prototype.addConnection = function(connID){
  this.list[connID] = true;
  this.total++;
};

IncomingCallBack.prototype.executeCallBack = function(conn, args){
  if(this.list[conn.id] !== undefined){

    // console.log("CallBack Executing", this.callBackID, this.total, this.list);
    this.callBack.apply(conn, args);
    this.total--;
    delete this.list[conn.id];
    this.evaluateDestroy();
  }
};


IncomingCallBack.prototype.callBackError = function(conn, args){

  if(this.list[conn.id] !== undefined){
    // console.log("CallBack Error", this.callBackID, args);
    this.total--;
    delete this.list[conn.id];
    this.evaluateDestroy();
  }
};

IncomingCallBack.prototype.evaluateDestroy = function(){
  if(this.total <= 0){
    // console.log("Deleting CallBack", this.callBackID);
    delete incomingCallBacks[this.callBackID];
    redisSub.punsubscribe("CB:"+this.callBackID+"*");
  }
};

