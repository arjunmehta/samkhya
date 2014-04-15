/*!
 * memory based comChannel extension for Samsaara
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var self;
var helper = require("../lib/helper.js");

var connectionController = require('./connectionController.js');
var communication = require('./communication.js');

var samsaara;


function Store(){}


Store.prototype.initialize = function (samsaara){
  self = samsaara;
  self.processID = "" + process.pid;
};



Store.prototype.sendTo = function (who, packet, theCallBack){

  var lengthOfGroup;

  //EVERYONE//////////////////////////////////////////////////////
  if(who === "everyone"){

    lengthOfGroup = Object.keys(self.connections).length;

    makeCallBack(lengthOfGroup, who, packet, theCallBack, function (whichOne, packetReady){

      for (var client in self.connections) {
        if (!self.connections.hasOwnProperty(client)){ continue; }
        writeTo(self.connections[client], packetReady);
      }    
    });
  }


  //GROUP//////////////////////////////////////////////////////
  else if(typeof who === "object" && who !== null){

    lengthOfGroup = Object.keys(who).length;
    //USE Redis QUEUE Thing
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






function makeCallBack(numberOfClients, who, packet, theCallBack, callBack){
  var packetReadyJSON = packet;

  if(theCallBack && typeof theCallBack == "function"){
    packetReadyJSON = packet;
    var execFrom = this;
    var callBackID = helper.makeIdAlpha(12);

    communication.incomingCallBacks[callBackID] = { callBack: theCallBack, from: execFrom };

    communication.incomingCallBacksCount[callBackID] = {};
    communication.incomingCallBacksCount[callBackID].total = numberOfClients;
    communication.incomingCallBacksCount[callBackID].executed = 0;

    packetReadyJSON.callBack = callBackID;
    packetReadyJSON.owner = self.processID;
  }

  if(callBack && typeof callBack === "function"){
    callBack(who, JSON.stringify(packetReadyJSON) );
  }
}

function writeTo(conn, packetReady){
  conn.write( packetReady );
}







exports.Store = Store;
exports = module.exports = new Store();
