/*!
 * memory based comChannel extension for Samsaara
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var self;
var helper = require("../lib/helper.js");

var connectionController = require('./connectionController.js');
var communication = require('./communication.js');
var grouping = require('./grouping.js');

var samsaara;
var groups = grouping.groups;

var makeCallBack = communication.makeCallBack;
var writeTo = communication.writeTo;


function Store(){}


Store.prototype.initialize = function (samsaara){
  self = samsaara;
  self.processID = "" + process.pid;
};




Store.prototype.sendToGroup = function(who, packet, theCallBack){

  if(who === "everyone"){
    lengthOfGroup = Object.keys(connectionController.connections).length;

    makeCallBack(lengthOfGroup, who, packet, theCallBack, function (whichOne, packetReady){
      for (var client in connectionController.connections) {
        if (connectionController.connections[client] !== undefined){
          writeTo(connectionController.connections[client], packetReady);
        }
      }
    });
  }
  else{
    var group = groups[who];
    lengthOfGroup = Object.keys(group).length;

    makeCallBack(lengthOfGroup, group, packet, theCallBack, function (group, packetReady){
      for (var client in group) {
        if (!group.hasOwnProperty(client)) continue;
        if(connectionController.connections[client] !== undefined){
          writeTo(connectionController.connections[client], packetReady);
        }
      }
    });
  }
};


Store.prototype.sendTo = function (who, packet, theCallBack){

  var lengthOfGroup;

  //EVERYONE//////////////////////////////////////////////////////
  if(who === "everyone"){

    lengthOfGroup = Object.keys(connectionController.connections).length;

    makeCallBack(lengthOfGroup, who, packet, theCallBack, function (whichOne, packetReady){
      for (var client in connectionController.connections) {
        if (!connectionController.connections.hasOwnProperty(client)){ continue; }
        writeTo(connectionController.connections[client], packetReady);
      }
    });
  }

  //GROUP//////////////////////////////////////////////////////
  else if(typeof who === "object" && who !== null){

    lengthOfGroup = Object.keys(who).length;

    makeCallBack(lengthOfGroup, who, packet, theCallBack, function (group, packetReady){
      for (var client in group) {
        if (!group.hasOwnProperty(client)) continue;
        writeTo(connectionController.connections[client], packetReady);
      }
    });
  }

  //SINGLE//////////////////////////////////////////////////////
  else if(typeof who === "string"){

    makeCallBack(1, who, packet, theCallBack, function (whichOne, packetReady){
      if(helper.validProperty(whichOne, self.connections)){
        writeTo(connectionController.connections[whichOne], packetReady);
      }
    });
  }
};



exports.Store = Store;
exports = module.exports = new Store();
