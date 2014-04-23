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

var connectionController = require("./connectionController.js");

var authentication,
    authStore;

var sessions = {};

var samsaara;

function Authentication(){
  authentication = this;
  this.userSessions = {};
}

Authentication.prototype.initialize = function(parent){
  samsaara = parent;
};

Authentication.prototype.setRedisStore = function(){
  if(config.options.redisStore){
    authStore = require('./authentication-redis');
  }
  else{
    authStore = require('./authentication-memory');
  }
};


/************************************************************************************
 * User Token Methods
 ************************************************************************************/
 

Authentication.prototype.initiateUserToken = function(conn, sessionID, userID, callBack){

  authStore.validUserSession(sessionID, userID, function (err, userSessions){

    if(!err && userSessions){

      addNewConnectionSession(conn.id, userID, sessionID, userSessions, function (err, userSessions){

        if(!err){
          updateConnectionUserID(conn, userID, function (token, userID){
            if(typeof callBack === "function") callBack(err, token, userID);
          });
        }
        else{
          if(typeof callBack === "function") callBack(err, false, false);
        }
      });
    }
    else{
      if(typeof callBack === "function") callBack(err, false, false);
    }
  });
};

Authentication.prototype.requestRegistrationToken = function(callBack){

  log.info(processID, moduleName, "CLIENT, requestion login Token", this.id);

  generateRegistrationToken(this.id, function (err, regtoken){
    if(typeof callBack === "function") callBack(err, regtoken);
  });

};

function generateRegistrationToken(connID, callBack){

  var tokenSalt = helper.makeIdAlpha(22);
  var regtoken = helper.makeUniqueHash("sha1", "Registration Key", [connID.toString(), tokenSalt]);
  
  samsaara.client.setex("REGTOKEN:" + regtoken, 10, tokenSalt, function (err, reply){
    log.info(processID, moduleName, "GENERATING REGISTRATION TOKEN FOR", connID, regtoken, tokenSalt, err, reply);
    if(typeof callBack === "function") callBack(false, regtoken);
  });
}


Authentication.prototype.validateRegistrationToken = function(connID, regtoken, tokenSalt, callBack){

  samsaara.client.get("REGTOKEN:" + regtoken, function (err, reply){

    log.info(processID, moduleName, "VALIDATING REGISTRATION TOKEN FOR", connID, err, reply, tokenSalt);

    if(!err && reply){

      if(tokenSalt === reply){

        var regtokenGen = helper.makeUniqueHash("sha1", "Registration Key", [connID.toString(), tokenSalt]);

        if(regtokenGen === regtoken){
          if(typeof callBack === "function") callBack(false, true);
        }
        else{
          if(typeof callBack === "function") callBack("MISMATCHED TOKEN", false);
        }
      }
      else{
        if(typeof callBack === "function") callBack("MISMATCHED TOKEN KEY", false);
      }

      samsaara.client.del("REGTOKEN:" + regtoken, function (err, reply){
        log.info(processID, moduleName, "DELETED REGTOKEN:", regtoken, err, reply);
      });
    }
    else{
      if(typeof callBack === "function") callBack("INVALID REGISTRATION TOKEN", false);
    }
  });
};


Authentication.prototype.retrieveRegistrationToken = function(regtoken, callBack){

  if(config.options.redisStore){
  
    samsaara.client.get("REGTOKEN:" + regtoken, function (err, reply){
  
      log.info(processID, moduleName, "RETRIEVING REGISTRATION TOKEN", regtoken, err, reply);
  
      if(!err && reply){
        if(typeof callBack === "function") callBack(false, reply);
      }
      else{
        if(typeof callBack === "function") callBack("INVALID REGISTRATION TOKEN", false);
      }
    });

  }
  else{
    
  }

};


function addNewConnectionSession(connID, userID, sessionID, userSessions, callBack){

  userSessions[sessionID][connID] = 1;

  samsaara.client.hset("userSessions", userID, JSON.stringify(userSessions), function (err, reply){
    if(err === null){
      if(typeof callBack === "function") callBack(null, userSessions);
    }
    else{
      console.log(processID, moduleName, "REDIS USER SESSION UPDATE ERROR", err);
      if(typeof callBack === "function") callBack(err, false);
    }
  });
}


Authentication.prototype.removeConnectionSession = function(connID, callBack){

  var conn = connectionController.connections[connID];

  if(conn && conn.navInfo && conn.navInfo.sessionInfo){

    var userID = conn.navInfo.sessionInfo.userID;
    var sessionID = conn.navInfo.sessionInfo.sessionID;

    authStore.validUserSession(sessionID, userID, function (err, userSessions){

      if(!err && userSessions && userSessions[sessionID]){

        delete userSessions[sessionID][connID];

        samsaara.client.hset("userSessions", userID, JSON.stringify(userSessions), function (err, reply){
          if(!err){
            if(typeof callBack === "function") callBack(null, userSessions);
          }
          else{
            log.error(processID, moduleName, "REDIS USER SESSION DELETE ERROR", err);
            if(typeof callBack === "function") callBack(err, false);
          }
        });
      }
      else{
        if(typeof callBack === "function") callBack("sessionID doesn't exist in RedisStore UserSessions for UserID", false);
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


// REDIS USER SESSION Methods
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////






function addRedisUserSession(sessionID, userID, callBack){

  authStore.validUserSession(sessionID, userID, function(err, theUsersSessions){

    if(err === "sessionUnregistered" && theUsersSessions){
      log.info(processID, moduleName, "UserID exists but session unregistered on Redis");

      registerRedisUserSession(theUsersSessions, sessionID, userID, function (err, reply){
        if(err){
          if(typeof callBack === "function") callBack(err, false);
        }
        else{
          if(typeof callBack === "function") callBack(null, reply);
        }
      });
    }

    else if(err == "0" && !theUsersSessions){

      log.info(processID, moduleName, "User ID doesn't exist, creating new Redis Hash");

      registerRedisUserSession({}, sessionID, userID, function (err, reply){

        if(err){
          if(typeof callBack === "function") callBack(err, false);
        }

        else{
          samsaara.redisSub.subscribe("USR:" + userID, function (err, reply){
            if(err){
              if(typeof callBack === "function") callBack(err, false);
            }
            else{
              if(typeof callBack === "function") callBack(null, reply);
            }
          });
        }
      });

    }

    else if(!err && theUsersSessions){ // very very unlikely
      log.info(processID, moduleName, "REDIS Session Addition for User", userID, sessionID, "already exists"); // Session Exists already!
      if(typeof callBack === "function") callBack("existsAlready", false);
    }

    else{
      log.error(processID, moduleName, "REDIS Incorrect/Invalid Setting for Redis Session Addition", userID, sessionID); // notValid Input
      if(typeof callBack === "function") callBack("invalid", false);
    }

  });
}


function registerRedisUserSession(theUsersSessions, sessionID, userID, callBack){

  theUsersSessions[sessionID] = {};
  log.info(processID, moduleName, "REGISTER REDIS SESSION", theUsersSessions);

  samsaara.client.hset("userSessions", userID, JSON.stringify(theUsersSessions), function (err, reply){

    log.info(processID, moduleName, "creating userID", userID, theUsersSessions, err, reply);
    if(typeof callBack === "function") callBack(err, reply);

  });
}



/**
 * Add and Remove UserSessions
 * Adds a reference to the HTTP Session, associated with a specific User.
 */

Authentication.prototype.addUserSession = function (sessionID, userID, callBack){

  if(config.options.redisStore){

    samsaara.client.hset("samsaara:sessions", sessionID, userID, function (err, reply){

      addRedisUserSession(sessionID, userID, function (err, reply){
        if(typeof callBack === "function") callBack (err, true);
      });

    });

    log.info(processID, moduleName, "Trying to add Redis Session");   

  }
  else{

    sessions[sessionID] = userID;

    if(authentication.userSessions[userID] === undefined){
      authentication.userSessions[userID] = { activeSessions: { sessionID: true }};
    }
    else{
      authentication.userSessions[userID].activeSessions[sessionID] = true;
    }
    if(typeof callBack === "function") callBack (false, true);
  }  
};

Authentication.prototype.removeUserSession = function(sessionID, userID, callBack){

  if(config.options.redisStore){

    samsaara.client.hdel("samsaara:sessions", sessionID, function (err, reply){
      
    });

    authStore.validUserSession(sessionID, userID, function (err, userSessions){

      if(userSessions && userSessions[sessionID]){

        delete userSessions[sessionID];
        if(Object.keys(userSessions).length === 0){
          samsaara.client.hdel("userSessions", userID, function (err, reply){
            if(typeof callBack === "function") callBack(err, reply);
          });
        }
        else{
          samsaara.client.hset("userSessions", userID, JSON.stringify(userSessions), function (err, reply){
            if(!err)
              if(typeof callBack === "function") callBack(err, reply);
            else
              log.info(processID, moduleName, "REDIS USER SESSION DELETE ERROR", err);
          });
        }
      }
      else{
        if(typeof callBack === "function") callBack("User Session or Session ID do not exist", null);
      }
    });
  }
  else{
    delete sessions[sessionID];
    delete authentication.userSessions[userID].activeSessions[sessionID];
    if(Object.keys(authentication.userSessions[userID].activeSessions).length === 0){
      delete authentication.userSessions[userID];
    }
  }

};



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

      if(typeof callBack === "function") callBack(userName, sessionID, userID);
    }
    else{
      if(typeof callBack === "function") callBack(req.session.userName, req.session.sessionID, req.session.userID);
    }

  }
  if(reqType == "connection"){

    var whichOne = source.whichOne;
    var sessionInfo = whichOne.navInfo.sessionInfo || {};

    userName = sessionInfo.userName || ("anon" + helper.makeIdAlpha(15));
    sessionID = sessionInfo.sessionID || ("anon" + helper.makeIdAlpha(15));
    userID = sessionInfo.userID || ("userID" + helper.makeIdAlpha(15));

    if(typeof callBack === "function") callBack(userName, sessionID, userID);
  }
};



Authentication.prototype.getRequestSessionInfo = function(sessionID, callBack){
  if(config.options.redisStore){
    samsaara.client.hget("samsaara:sessions", sessionID, function (err, userID){
      if(typeof callBack === "function") callBack(sessionID, userID);
    });
  }
  else{
    if(typeof callBack === "function") callBack(sessionID, sessions[sessionID]);
  }
};

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
//           samsaara.comStore.sendToForeign("User", userID, {func: "addConnectionToUser", args: ["direct", {userID: userID, connID: whichOne.id}], specialKey: samsaara.specialKey }, callBack);
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

  if(authentication.userSessions[userID]){
    if(typeof callBack === "function") callBack(true, "local");
  }
  else{
    if(config.options.redisStore){
      samsaara.client.hexists("userSessions", userID, function(err, reply){
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
