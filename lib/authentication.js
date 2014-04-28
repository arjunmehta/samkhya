/*!
 * Samsaara - authentication Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

exports = module.exports = new Authentication();

var path = require("path");
var log = require("./log.js");
var moduleName = path.basename(module.filename);
var processID = process.pid.toString();

var helper = require("./helper.js");
var config = require("./config.js");

var samsaara = ('../index.js');
var connectionController = require("./connectionController.js");

var authentication,
    authStore;

var sessions, userSessions;

function Authentication(){
  authentication = this;
  this.userSessions = userSessions = {};
  this.sessions = sessions = {};
}

Authentication.prototype.setRedisStore = function(){
  if(config.redisStore === true){
    authStore = require('./authentication-redis');
  }
  else{
    authStore = require('./authentication-memory');
  }

  this.exported = {
    addUserSession: authStore.addUserSession,
    removeUserSession: authStore.removeUserSession
  };

  this.getRequestSessionInfo = authStore.getRequestSessionInfo;
  this.retrieveRegistrationToken = authStore.retrieveRegistrationToken;
  this.validateRegistrationToken = authStore.validateRegistrationToken;
};

Authentication.prototype.initiateUserToken = function(conn, sessionID, userID, callBack){

  // console.log("INITIATING USER TOKEN", conn.id, sessionID, userID);

  authStore.validUserSession(sessionID, userID, function (err, userSessions){

    // console.log("validUserSession", sessionID, userID);

    if(err === null && userSessions !== undefined){

      authStore.addNewConnectionSession(conn.id, userID, sessionID, userSessions, function (err, userSessions){

        // console.log("addNewConnectionSession", userSessions);

        if(err === null){
          updateConnectionUserID(conn, userID, function (token, userID){
            if(typeof callBack === "function") callBack(err, token, userID);
          });
        }
        else{
          if(typeof callBack === "function") callBack(err, null, null);
        }
      });
    }
    else{
      if(typeof callBack === "function") callBack(err, null, null);
    }
  });
};

Authentication.prototype.requestRegistrationToken = function(callBack){

  console.log(processID, moduleName, "CLIENT, requesting login Token", this.id);

  authStore.generateRegistrationToken(this.id, function (err, regtoken){
    if(typeof callBack === "function") callBack(err, regtoken);
  });

};


Authentication.prototype.removeConnectionSession = function(connID, callBack){

  var conn = connectionController.connections[connID];

  if(conn !== undefined && conn.navInfo !== undefined && conn.navInfo.sessionInfo !== undefined){

    var userID = conn.navInfo.sessionInfo.userID;
    var sessionID = conn.navInfo.sessionInfo.sessionID;

    authStore.validUserSession(sessionID, userID, function (err, userSessions){

      if(!err && userSessions !== undefined && userSessions[sessionID] !== undefined){
        delete userSessions[sessionID][connID];
        authStore.updateUserSession(userID, userSessions, callBack);        
      }
      else{
        if(typeof callBack === "function") callBack("sessionID doesn't exist in UserSessions for UserID", false);
      }

    });
  }
  else{
    if(typeof callBack === "function") callBack("sessionInfo not found on connection", false);
  }
};


function updateConnectionUserID (conn, userID, callBack){
  conn.userID = userID;
  conn.oldToken = conn.token;
  conn.token = helper.makeUniqueHash('sha1', conn.key, [conn.userID]);
  if(typeof callBack === "function") callBack(conn.token, userID);
}


Authentication.prototype.getConnectionSessionInfo = function(whichOne, callBack){
  var sessionInfo = whichOne.navInfo.sessionInfo || {};
  sessionID = sessionInfo.sessionID || ("anon" + helper.makeIdAlpha(15));
  userID = sessionInfo.userID || ("userID" + helper.makeIdAlpha(15));
  if(typeof callBack === "function") callBack(sessionID, userID);
};

// Authentication.prototype.addConnectionToUser = function(reqType, source, callBack){

//   //Ontological Existence in Various Contexts

//   if(reqType == "direct"){
//     var userID = source.userID;
//     var connID = source.connID;
//     authentication.userSessions[userID].openConnections[connID] = true;
//     log.info(processID, moduleName, "EXECUTING add CONNECTION TO USER");
//     if(typeof callBack === "function") callBack(connID + " Added to UserSessions on " + processID);
//   }
//   else{
//     userSessionExists(reqType, source, function(exists, userName, sessionID, userID){

//       if(reqType == "connection"){

//         var whichOne = source.whichOne;

//         if(exists == "local"){
//           authentication.userSessions[userID].openConnections[whichOne.id] = true;
//           if(typeof callBack === "function") callBack(whichOne.id + " Added to UserSessions on " + processID);
//         }
//         else if(exists == "foreign"){
//           communication.sendToForeign("User", userID, {func: "addConnectionToUser", args: ["direct", {userID: userID, connID: whichOne.id}], specialKey: config.specialKey }, callBack);
//         }
//         else{
//           //log.info(processID, moduleName, "USER NOT LOGGED IN, LOGIN USER");
//           if(typeof callBack === "function") callBack("USER NOT LOGGED IN " + processID);
//         }
//       }
//     });
//   }
// };


function userSessionExists(userID, source, callBack){

  if(userSessions[userID]){
    if(typeof callBack === "function") callBack(true, "local");
  }
  else{
    if(config.redisStore === true){
      config.redisClient.hexists("userSessions", userID, function(err, reply){
        if(reply == 1){
          if(typeof callBack === "function") callBack(true, "foreign");
        }
        else{
          if(typeof callBack === "function") callBack(false, false);
        }
      });
    }
    else{
      if(typeof callBack === "function") callBack(false, false);
    }
  }
}
