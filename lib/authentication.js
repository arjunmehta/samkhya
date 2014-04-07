/*!
 * argyleSocks - authentication Methods
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

var crypto = require("crypto");

var connectionController = require("./connectionController.js");
var communication = require("./communication.js");

var User = require("../models/user.js");

var authentication;
var argyle;

function Authentication(){
  authentication = this;
  this.userSessions = {};
}

Authentication.prototype.initialize = function(parent){
  argyle = parent;
}

Authentication.prototype.initiateUserToken = function(conn, sessionID, userID, callBack){

  validRedisSession(sessionID, userID, function (err, userSessions){

    if(!err && userSessions){

      addNewConnectionSession(conn.id, userID, sessionID, userSessions, function (err, userSessions){

        if(!err){
          updateConnectionUserID(conn, userID, function (token, userID){
            if(callBack && typeof callBack === "function") callBack(err, token, userID);
          });
        }
        else{
          if(callBack && typeof callBack === "function") callBack(err, false, false);
        }
      });
    }
    else{
      if(callBack && typeof callBack === "function") callBack(err, false, false);
    }
  });
}

Authentication.prototype.requestLoginToken = function(callBack){

  log.info(processID, moduleName, "CLIENT, requestion login Token", this.id);

  generateRegistrationToken(this.id, function (err, regtoken){
    if(callBack && typeof callBack === "function") callBack(err, regtoken);
  });
}


function generateRegistrationToken(connID, callBack){

  var tokenSalt = helper.makeIdAlpha(22);
  var regtoken = helper.makeUniqueHash("sha1", "Registration Key", [connID.toString(), tokenSalt]);

  argyle.client.setex("REGTOKEN:" + regtoken, 10, tokenSalt, function (err, reply){
    log.info(processID, moduleName, "GENERATING REGISTRATION TOKEN FOR", connID, regtoken, tokenSalt, err, reply);
    if(callBack && typeof callBack === "function") callBack(false, regtoken);
  });
}


Authentication.prototype.validateRegistrationToken = function(connID, regtoken, tokenSalt, callBack){

  argyle.client.get("REGTOKEN:" + regtoken, function (err, reply){

    log.info(processID, moduleName, "VALIDATING REGISTRATION TOKEN FOR", connID, err, reply, tokenSalt);

    if(!err && reply){

      if(tokenSalt === reply){

        var regtokenGen = helper.makeUniqueHash("sha1", "Registration Key", [connID.toString(), tokenSalt]);

        if(regtokenGen === regtoken){
          if(callBack && typeof callBack === "function") callBack(false, true);
        }
        else{
          if(callBack && typeof callBack === "function") callBack("MISMATCHED TOKEN", false);
        }
      }
      else{
        if(callBack && typeof callBack === "function") callBack("MISMATCHED TOKEN KEY", false);
      }

      argyle.client.del("REGTOKEN:" + regtoken, function (err, reply){
        log.info(processID, moduleName, "DELETED REGTOKEN:", regtoken, err, reply);
      });
    }
    else{
      if(callBack && typeof callBack === "function") callBack("INVALID REGISTRATION TOKEN", false);
    }
  });
}


Authentication.prototype.retrieveRegistrationToken = function(regtoken, callBack){

  argyle.client.get("REGTOKEN:" + regtoken, function (err, reply){

    log.info(processID, moduleName, "RETRIEVING REGISTRATION TOKEN", regtoken, err, reply);

    if(!err && reply){
      if(callBack && typeof callBack === "function") callBack(false, reply);
    }
    else{
      if(callBack && typeof callBack === "function") callBack("INVALID REGISTRATION TOKEN", false);
    }
  });
  
}


function addNewConnectionSession(connID, userID, sessionID, userSessions, callBack){

  userSessions[sessionID][connID] = 1;

  argyle.client.hset("userSessions", userID, JSON.stringify(userSessions), function (err, reply){
    if(!err && reply)
      if(callBack && typeof callBack === "function") callBack(null, userSessions);
    else{
      log.info(processID, moduleName, "REDIS USER SESSION UPDATE ERROR", err);
      if(callBack && typeof callBack === "function") callBack(err, false);
    }
  });
}


Authentication.prototype.removeConnectionSession = function(connID, callBack){

  var conn = connectionController.connections[connID];

  if(conn && conn.navInfo && conn.navInfo.sessionInfo){

    var userID = conn.navInfo.sessionInfo.userID;
    var sessionID = conn.navInfo.sessionInfo.sessionID;

    validRedisSession(sessionID, userID, function (err, userSessions){

      if(!err && userSessions && userSessions[sessionID]){

        delete userSessions[sessionID][connID];

        argyle.client.hset("userSessions", userID, JSON.stringify(userSessions), function (err, reply){
          if(!err){
            if(callBack && typeof callBack === "function") callBack(null, userSessions);
          }
          else{
            log.error(processID, moduleName, "REDIS USER SESSION DELETE ERROR", err);
            if(callBack && typeof callBack === "function") callBack(err, false);
          }
        });
      }
      else{
        if(callBack && typeof callBack === "function") callBack("sessionID doesn't exist in RedisStore UserSessions for UserID", false);
      }
    });

  }
  else{
    if(callBack && typeof callBack === "function") callBack("sessionInfo not found on connection", false);
  }
}


function updateConnectionUserID (conn, userID, callBack){

  conn.userID = userID;
  conn.oldToken = conn.token;

  conn.token = helper.makeUniqueHash('sha1', conn.key, [conn.userID]);

  if(callBack && typeof callBack === "function") callBack(conn.token, userID);

}


// REDIS USER SESSION Methods
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function validRedisSession(sessionID, userID, callBack){

  // unsecret userID & sessionID
  if(config.options.redisStore){

    if(sessionID && userID){
      argyle.client.hget("userSessions", userID, function (err, reply){

        log.info(processID, moduleName, "REDIS SESSION VALIDATION", err, reply);

        if(err)
          log.error(processID, moduleName, "USER SESSION QUERY ERROR:", err);

        if(reply != null && reply != "0"){

          var theUsersSessions = JSON.parse(reply);

          if(theUsersSessions[sessionID]){
            if(callBack && typeof callBack === "function") callBack(false, theUsersSessions);
          }
          else if(theUsersSessions){
            if(callBack && typeof callBack === "function") callBack("sessionUnregistered", theUsersSessions);
          }

        }
        else{
          if(callBack && typeof callBack === "function") callBack("0", false);
        }
      });
    }
    else{
      if(callBack && typeof callBack === "function") callBack("Incorrect number of Parameters", false);
    }
  }
}


function addRedisSession(sessionID, userID, callBack){

  validRedisSession(sessionID, userID, function(err, theUsersSessions){

    if(err == "sessionUnregistered" && theUsersSessions){
      log.info(processID, moduleName, "UserID exists but session unregistered on Redis");

      registerRedisSession(theUsersSessions, sessionID, userID, function (err, reply){
        if(err){
          if(callBack && typeof callBack === "function") callBack(err, false);
        }
        else{
          if(callBack && typeof callBack === "function") callBack(null, reply);
        }
      });
    }

    else if(err == "0" && !theUsersSessions){

      log.info(processID, moduleName, "User ID doesn't exist, creating new Redis Hash");

      registerRedisSession({}, sessionID, userID, function (err, reply){

        if(err){
          if(callBack && typeof callBack === "function") callBack(err, false);
        }

        else{
          argyle.redisSub.subscribe("USR:" + userID, function (err, reply){
            if(err){
              if(callBack && typeof callBack === "function") callBack(err, false);
            }
            else{
              if(callBack && typeof callBack === "function") callBack(null, reply);
            }
          });
        }
      });
    }

    else if(!err && theUsersSessions){ // very very unlikely
      log.info(processID, moduleName, "REDIS Session Addition for User", userID, sessionID, "already exists"); // Session Exists already!
      if(callBack && typeof callBack === "function") callBack("existsAlready", false);
    }

    else{
      log.error(processID, moduleName, "REDIS Incorrect/Invalid Setting for Redis Session Addition", userID, sessionID); // notValid Input
      if(callBack && typeof callBack === "function") callBack("invalid", false);
    }

  });
}


function registerRedisSession(theUsersSessions, sessionID, userID, callBack){

  theUsersSessions[sessionID] = {};
  log.info(processID, moduleName, "REGISTER REDIS SESSION", theUsersSessions);

  argyle.client.hset("userSessions", userID, JSON.stringify(theUsersSessions), function (err, reply){

    log.info(processID, moduleName, "creating userID", userID, theUsersSessions, err, reply);
    if(callBack && typeof callBack === "function") callBack(err, reply);

  });
}


Authentication.prototype.signUpUser = function (userName, password, email, callBack){
  createNewUser(userName, password, email, callBack);
}

Authentication.prototype.loginUser = function(userName, password, callBack){
  addUserSession(userName, password, callBack);
}

Authentication.prototype.logoutUser = function(req, res, callBack){

  log.info(processID, moduleName, "SESSION", req.session);
  log.info(processID, moduleName, "USER", req.user);

  var userID = req.user.userID;
  var sessionID = req.user.sessionID;

  removeUserSession(sessionID, userID, function (err, reply){
    req.session.destroy();
    if(callBack && typeof callBack === "function") callBack(req, res);
  });
}


function removeUserSession(sessionID, userID, callBack){

  validRedisSession(sessionID, userID, function (err, userSessions){
    if(userSessions && userSessions[sessionID]){

      delete userSessions[sessionID];
      if(Object.keys(userSessions).length == 0){
        argyle.client.hdel("userSessions", userID, function (err, reply){
          if(callBack && typeof callBack === "function") callBack(err, reply);
        })
      }
      else{
        argyle.client.hset("userSessions", userID, JSON.stringify(userSessions), function (err, reply){
          if(!err)
            if(callBack && typeof callBack === "function") callBack(err, reply);
          else
            log.info(processID, moduleName, "REDIS USER SESSION DELETE ERROR", err);
        });
      }
    }
  });
}



function addUserSession(userName, password, callBack){

  var numberOfOps = 1;
  var executedOps = 0;

  argyle.getFromDB("symphonyusers", userName, function (err, body){

    var userID;
    var sessionID;

    if(err){
      if(callBack && typeof callBack === "function") callBack("UserName Does Not Exist in DataBase", false, false);
    }
    else{

      userID = body.userID;

      //redis userSessions name thing.
      authentication.userSessions[userID] = new User(userName);
      authentication.userSessions[userID].userData = body;

      var match = testPassword(authentication.userSessions[userID].userData.passwordHash, userName, userID, password);

      if(match){

        sessionID = generateUniqueSessionID(userID);

        authentication.userSessions[userID].userData.mostRecentSession = sessionID;
        authentication.userSessions[userID].activeSessions[sessionID] = true;

        if(config.options.redisStore){
          numberOfOps++;
          log.info(processID, moduleName, "Trying to add Redis Session");
          addRedisSession(sessionID, userID, function (err, reply){
            _evalLoginDB(err, sessionID, userID);
          });
        }

        log.info(processID, moduleName, "Trying to save to Couch");
        argyle.storeToDB("symphonyusers", userName, authentication.userSessions[userID].userData, function (err, reply){
          _evalLoginDB(err, sessionID, userID);
        });

      }
      else{
        if(callBack && typeof callBack === "function") callBack("password mismatch", false, false);
      }
    }

  });

  function _evalLoginDB(err, sessionID, userID){
    executedOps++;
    log.info(processID, moduleName, "EVALUATING LOGIN DB STUFF");
    if(numberOfOps == executedOps){
      log.info(processID, moduleName, "DONE EVALUATING LOGIN DB STUFF", sessionID, userID);
      if(callBack && typeof callBack === "function") callBack (err, sessionID, userID);
    }
  }
}


function createNewUser(userName, password, email, callBack){

  var userID = generateUniqueUserID(userName);
  var passwordHash = generateUniquePasswordHash(userName, userID, password);

  authentication.userSessions[userID] = new User(userName, userID, email, passwordHash);
  log.info(processID, moduleName, "CREATED NEW USER LOCALLY:", authentication.userSessions[userID]);    

  argyle.getFromDB("symphonyusers", userName, function (err, reply){
    if(err){
      argyle.directStoreToDB("symphonyusers", userName, authentication.userSessions[userID].userData, function (err, reply){
        if(callBack && typeof callBack === "function") callBack (err, userName, password);
      });        
    }
    else{
      if(callBack && typeof callBack === "function") callBack("USER EXISTS", false, false);
    }
  });
}


// GENERATORS & CRYPTOGRAPHY

function generateUniqueUserID(userName){
  var userID;
  userID = helper.makeUniqueHash('sha1', 'It is all so very special', [userName.toString(), helper.getCurrentTime().toString()]);

  log.info(processID, moduleName, "Generating Unique User ID from UserName", userName, userID);
  return userID;
}

function generateUniqueSessionID(userID){
  log.info(processID, moduleName, "Generating Unique Session ID from UserID", userID);

  var sessionID;
  sessionID = helper.makeUniqueHash('sha1', 'It is all so very special', [userID.toString(), helper.getCurrentTime().toString()]);
  return sessionID;
}

function generateUniquePasswordHash(userName, userID, password){
  var passwordHash;
  passwordHash = helper.makeUniqueHash('sha256', 'It is indeed very special', [userName.toString(), userID.toString(), password.toString()]);

  log.info(processID, moduleName, "Generating Unique passwordHash from UserName", userName, passwordHash);

  return passwordHash;
}

function testPassword(savedHash, userName, userID, password){
  var givenPasswordHash = generateUniquePasswordHash(userName, userID, password);

  log.info(processID, moduleName, "TESTING PASSWORD", givenPasswordHash, savedHash, userName, userID, password);

  if(givenPasswordHash == savedHash) return true;
  else return false;
}




Authentication.prototype.getSessionInfo = function(reqType, source, callBack){

  var userName;
  var sessionID;
  var userID;

  if(reqType == "request"){

    var req = source.req;
    var res = source.res;

    if(config.options.redisStore){

      userName = req.user.userName;
      sessionID = req.user.sessionID;
      userID = req.user.userID;

      if(callBack && typeof callBack =="function") callBack(userName, sessionID, userID);
    }
    else{
      if(callBack && typeof callBack =="function") callBack(req.session.userName, req.session.sessionID, req.session.userID);
    }

  }
  if(reqType == "connection"){

    var whichOne = source.whichOne;
    var sessionInfo = whichOne.navInfo.sessionInfo || {};

    userName = sessionInfo.userName || ("anon" + helper.makeIdAlpha(15));
    sessionID = sessionInfo.sessionID || ("anon" + helper.makeIdAlpha(15));
    userID = sessionInfo.userID || ("userID" + helper.makeIdAlpha(15));

    if(callBack && typeof callBack =="function") callBack(userName, sessionID, userID);
  }
};

Authentication.prototype.addConnectionToUser = function(reqType, source, callBack){

  //Ontological Existence in Various Contexts

  if(reqType == "direct"){
    var userID = source.userID;
    var connID = source.connID;
    authentication.userSessions[userID].openConnections[connID] = true;
    log.info(processID, moduleName, "EXECUTING add CONNECTION TO USER");
    if(callBack && typeof callBack === "function") callBack(connID + " Added to UserSessions on " + processID);
  }
  else{
    userSessionExists(reqType, source, function(exists, userName, sessionID, userID){

      if(reqType == "connection"){

        var whichOne = source.whichOne;

        if(exists == "local"){
          authentication.userSessions[userID].openConnections[whichOne.id] = true;
          if(callBack && typeof callBack === "function") callBack(whichOne.id + " Added to UserSessions on " + processID);
        }
        else if(exists == "foreign" && reqType == "connection"){
          argyle.comStore.sendToForeign("User", userID, {func: "addConnectionToUser", args: ["direct", {userID: userID, connID: whichOne.id}], specialKey: argyle.specialKey }, callBack);
        }
        else{
          //log.info(processID, moduleName, "USER NOT LOGGED IN, LOGIN USER");
          if(callBack && typeof callBack === "function") callBack("USER NOT LOGGED IN " + processID);
        }
      }
    });
  }
}

function userSessionExists(reqType, source, callBack){

  authentication.getSessionInfo(reqType, source, function (userName, sessionID, userID){

    if(authentication.userSessions[userID]){
      if(callBack && typeof callBack === "function") callBack("local", userName, userID, userID);
    }
    else{
      if(config.options.redisStore){
        argyle.client.hexists("userSessions", userID, function(err, reply){
          if(reply == 1){
            if(callBack && typeof callBack === "function") callBack("foreign", userName, sessionID, userID);
          }
          else{
            if(callBack && typeof callBack === "function") callBack(false);
          }
        });
      }
      else{
        if(callBack && typeof callBack === "function") callBack(false);
      }
    }
  });
}




//User Sessions
Authentication.prototype.UserSession = function (id, userName, connectionID){

  this.sessionID = id;
  this.userName = userName;
  this.conn = connectionID;

  this.creationDate = new Date().getTime();
  this.modDate = new Date().getTime();
}