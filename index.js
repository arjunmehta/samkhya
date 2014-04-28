/*!
 * Samsaara
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var util = require('util');
var log = require("./lib/log.js");
var helper = require('./lib/helper.js');

var EventEmitter = require('events').EventEmitter;
util.inherits(Samsaara, EventEmitter);

var samsaara = new Samsaara();

function Samsaara(){

  EventEmitter.call(this);

  var config = require('./lib/config.js');
  config.emit = emitter(this);

  function emitter(samsaara){
    return function(){
      samsaara.emit.apply(samsaara, arguments);
    };
  }

  var sockjs = require('sockjs');  
  var sockjsOpts = { _pathTo: "/echo" };
  var sockjsServer = sockjs.createServer();

  var connectionController = require('./lib/connectionController.js');
  var communication = require('./lib/communication.js');
  var authentication = require('./lib/authentication.js');
  var contextController = require('./lib/contextController.js'); 
  var grouping = require('./lib/grouping.js');

  var bringToMain = {

    connections: connectionController.connections,
    sendTo: communication.sendTo,
    sendToClient: communication.sendToClient,
    sendToGroup: communication.sendToGroup,
    nameSpaces: communication.nameSpaces,
    expose: communication.expose,
    exposeNamespace: communication.exposeNamespace,

    contexts: contextController.contexts,
    openContext: contextController.openContext,
    openContextWithData: contextController.openContextWithData,
    isContextOpen: contextController.isContextOpen,
    switchContext: contextController.switchContext,
    linkContext: contextController.linkContext,
    clearFromContext: contextController.clearFromContext,

    addUserSession: authentication.addUserSession,
    removeUserSession: authentication.removeUserSession,

    Context: contextController.Context,
    Access: contextController.Access,
    Connection: connectionController.Connection,

    groups: grouping.groups,
    createGroup: grouping.createGroup,
    inGroup: grouping.inGroup,
    addToGroup: grouping.addToGroup,
    removeFromGroup: grouping.removeFromGroup

  };

  for(var func in bringToMain){
    this[func] = bringToMain[func];
  }

  this.nameSpaces.internal = {
    windowResize: connectionController.windowResize,
    geoPosition: connectionController.geoPosition,
    callItBack: communication.callItBack,
    callItBackError: communication.callItBackError,
    requestRegistrationToken: authentication.requestRegistrationToken
  };

  this.nameSpaces.samsaara = {
    switchContext: contextController.switchContext
  };
  
  this.initialize = function (server, app, opts){

    if(opts){

      config.options = opts;
      sockjsOpts._pathTo = opts.pathTo || "/echo";

      if(opts.redisStore){   

        if(opts.redisPub && opts.redisSub && opts.redisClient){
          config.redisStore = true;
          config.redisPub = opts.redisPub;
          config.redisSub = opts.redisSub;
          config.redisClient = opts.redisClient;

          config.redisClient.get("specialKey", function(err, reply){
            config.specialKey = reply;
          });
        }
        else{
          throw "RedisClient for redisPub, redisSub and redisClient must be provided in order for samsaara to work using Redis.";
        }
      }

      contextController.setRedisStore();
      authentication.setRedisStore();
      communication.setRedisStore();

      for(var func in authentication.exported){
        this[func] = authentication.exported[func];
      }

      if(app){

        app.get('/samsaara/samsaara.js', function (req, res){
          res.sendfile(__dirname + '/client/samsaara.js');
        });

        app.get('/samsaara/sockjs.js', function (req, res){
          res.sendfile(__dirname + '/client/sockjs-0.3.min.js');
        });

        app.get('/samsaara/ee.js', function (req, res){
          res.sendfile(__dirname + '/client/EventEmitter.min.js');
        });

        app.get('/registerSamsaaraConnection', function (req, res) {

          var registrationToken = req.query.regtoken;

          authentication.retrieveRegistrationToken(registrationToken, function (err, reply){
            if(err === null){
              // Can this somehow be supplied by the developer?
              authentication.getRequestSessionInfo(req.sessionID, function (sessionID, userID){              
                var keyObject = { sessionID: sessionID, userID: userID, tokenKey: reply };
                res.send(keyObject);
              });
            }
            else{
              res.send({ err: err });
            }
          });
        });
      }
      else{
        throw "You must provide an Express app object so Samsaara can attach its authentication route";
      }
    }

    grouping.createGroup("everyone");

    sockjsServer.installHandlers( server, { prefix: sockjsOpts._pathTo } );
    sockjsServer.on('connection', function (conn){
      connectionController.createNewConnection(conn);
    });
  };

}

exports = module.exports = samsaara;

// Samsaara.prototype = Object.create(EventEmitter.prototype);




