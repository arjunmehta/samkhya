var samsaara = require('../index');

var path = require("path");
var log = require("./log.js");
var moduleName = path.basename(module.filename);
var processID = process.pid.toString();
var helper = require("./helper.js");
var config = require("./config.js");

var authentication = require('./authentication');

exports = module.exports;

exports.validUserSession = function(sessionID, userID, callBack){

  // unsecret userID & sessionID
  if(config.options.redisStore){

    if(sessionID && userID){
      samsaara.client.hget("userSessions", userID, function (err, reply){

        log.info(processID, moduleName, "REDIS SESSION VALIDATION", err, reply);

        if(err){
          log.error(processID, moduleName, "USER SESSION QUERY ERROR:", err);
        }

        if(reply != null && reply != "0"){

          var theUsersSessions = JSON.parse(reply);

          if(theUsersSessions[sessionID]){
            if(typeof callBack === "function") callBack(false, theUsersSessions);
          }
          else if(theUsersSessions){
            if(typeof callBack === "function") callBack("sessionUnregistered", theUsersSessions);
          }

        }
        else{
          if(typeof callBack === "function") callBack("0", false);
        }
      });
    }
    else{
      if(typeof callBack === "function") callBack("Incorrect number of Parameters", false);
    }
  }
};