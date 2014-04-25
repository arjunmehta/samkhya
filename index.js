/*!
 * Samsaara
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var log = require("./lib/log.js");
var helper = require('./lib/helper.js');

var EventEmitter = require('events').EventEmitter;

var samsaara = (function(samsaara){

  var config = require('./lib/config.js');
  var sockjs = require('sockjs');

  samsaara = new EventEmitter();

  config.options = {
    pathTo: "/echo"
  };

  var sockjsServer = sockjs.createServer();

  // require and initialize connection controller
  var connectionController = require('./lib/connectionController.js');
  connectionController.initialize(samsaara);

  // require and initialize communication controller
  var communication = require('./lib/communication.js');
  communication.initialize(samsaara);

  // require and initialize authentication controller
  var authentication = require('./lib/authentication.js');
  authentication.initialize(samsaara);

  // require and initialize context controller
  var contextController = require('./lib/contextController.js'); 
  contextController.initialize(samsaara);

  // require and initialize grouping and namespace controller
  var grouping = require('./lib/grouping.js');
  grouping.initialize(samsaara);

  var bringToMain = {
    connections: connectionController.connections,
    sendTo: communication.sendTo,
    sendToGroup: communication.sendToGroup,

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
    removeFromGroup: grouping.removeFromGroup,
    expose: grouping.expose,
    exposeNamespace: grouping.exposeNamespace
  };

  for(var func in bringToMain){
    samsaara[func] = bringToMain[func];
  }

  // Initialize Models
  samsaara.Context.initialize(samsaara);
  samsaara.Connection.initialize(samsaara);

  samsaara.expose({
    windowResize: connectionController.windowResize,
    geoPosition: connectionController.geoPosition,
    callItBack: communication.callItBack,
    requestRegistrationToken: authentication.requestRegistrationToken
  });

  samsaara.expose({
    switchContext: contextController.switchContext
  }, "samsaara");


  var sockjsOpts = { _pathTo: "/echo" };

  samsaara.initialize = function (server, app, opts){

    if(opts){
      config.options = opts;

      if(opts.pathTo){
        sockjsOpts._pathTo = opts.pathTo;
        log.info("setting opts.pathTo", sockjsOpts._pathTo);
      }

      if(opts.redisStore){
        samsaara.comStore = require('./lib/communication-redis.js');
        log.info("setting opts.redisStore");

        if(opts.redisPub && opts.redisSub && opts.redisClient){
          samsaara.pub = opts.redisPub;
          samsaara.sub = opts.redisSub;
          samsaara.client = opts.redisClient;
        }
        else{
          throw "RedisClient for redisPub, redisSub and redisClient must be provided in order for samsaara to work using Redis.";
        }

        samsaara.comStore.initialize(samsaara, samsaara.pub, samsaara.sub, samsaara.client);

      }
      else{
        samsaara.comStore = require('./lib/communication-memory.js');
        samsaara.comStore.initialize(samsaara);
      }

      contextController.setRedisStore(true);
      authentication.setRedisStore(true);

      for(var func in authentication.exported){
        samsaara[func] = authentication.exported[func];
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

    sockjsServer.installHandlers( server, { prefix: sockjsOpts._pathTo } );

    sockjsServer.on('connection', function (conn){
      connectionController.createNewConnection(conn);
    });
  };

  return samsaara;

}(this.samsaara = this.samsaara || {}));



exports = module.exports = samsaara;


