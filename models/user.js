/*!
 * argyleSocks - SymbolicConnection Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var helper = require('../lib/helper.js');

exports = module.exports = User;

function User(userName, userID, email, passwordHash){

  this.userData = {
    userName: userName,
    userID: userID,
    email: email,
    passwordHash: passwordHash,
    creationDate: new Date().getTime(),
    modDate: new Date().getTime(),

    ownContexts: {},
    mediaLibraries: {},

    mostRecentSession: ""
  };

  //associated connections
  this.openConnections = {};
  this.activeSessions = {};
}

User.prototype.addConnection = function (whichOne){
  this.openConnections[whichOne.id] = true;
}

User.prototype.removeConnection = function (whichOne){
  if(this.openConnections[whichOne.id]){
    delete this.openConnections[whichOne.id];
  }
}