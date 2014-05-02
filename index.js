/*!
 * Samsaara
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var log = require("./lib/log.js");
var helper = require('./lib/helper.js');

var EventEmitter = require('events').EventEmitter;

var samsaara = new EventEmitter();

exports = module.exports = samsaara;

samsaara = (function Samsaara(module){
 
  var config = module.config = require('./lib/config.js');

  // EventEmitter.call(module);  
  // config.emit = emitter(module);
  // function emitter(samsaara){
  //   return function(){
  //     samsaara.emit.apply(samsaara, arguments);
  //   };
  // }

  var sockjs = require('sockjs');  
  var sockjsOpts = { _pathTo: "/echo" };
  var sockjsServer = sockjs.createServer();

  var connectionController = module.connectionController = require('./lib/connectionController.js');  
  var communication = module.communication = require('./lib/communication.js');

  var authentication = require('./lib/authentication.js');
  var contextController = require('./lib/contextController.js');

  connectionController.setModels();

  module.ipc = {
    addIPCRoute : function(route, func){
      // console.log(route, func);
    },
    publish: {},
    subscribe: {},
    unsubscribe: {},
    subscribePattern: {},
    unsubscribePattern: {},
    routes: {}
  };

  var stack = [];

  var bringToMain = {

    connections: connectionController.connections,
    sendTo: communication.sendTo,
    sendToClient: communication.sendToClient,
    sendToGroup: communication.sendToGroup,
    nameSpaces: communication.nameSpaces,
    expose: communication.expose,
    exposeNamespace: communication.exposeNamespace,

    // contexts: contextController.contexts,
    // openContext: contextController.openContext,
    // openContextWithData: contextController.openContextWithData,
    // isContextOpen: contextController.isContextOpen,
    // switchContext: contextController.switchContext,
    // linkContext: contextController.linkContext,
    // clearFromContext: contextController.clearFromContext,

    addUserSession: authentication.addUserSession,
    removeUserSession: authentication.removeUserSession,

    Context: contextController.Context,
    Access: contextController.Access,
    Connection: connectionController.Connection,

  };

  for(var func in bringToMain){
    module[func] = bringToMain[func];
  }

  module.nameSpaces.internal = {
    windowResize: connectionController.windowResize,
    geoPosition: connectionController.geoPosition,
    callItBack: communication.callItBack,
    callItBackError: communication.callItBackError,
    requestRegistrationToken: authentication.requestRegistrationToken
  };

  module.nameSpaces.samsaara = {
    switchContext: contextController.switchContext
  };
  
  module.use = function(middleware){
    // console.log("NEW MIDDLEWARE", middleware);
    stack.push(middleware);
  };

  module.initialize = function (server, app, opts){

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
          throw new Error("RedisClient for redisPub, redisSub and redisClient must be provided in order for samsaara to work using Redis.");
        }
      }

      contextController.setRedisStore();
      authentication.setRedisStore();
      communication.setRedisStore();

      for(var func in authentication.exported){
        module[func] = authentication.exported[func];
      }

      console.log("MIDDLE WARE STACK ", JSON.stringify(stack));

      for (var i = 0; i < stack.length; i++) {
        initializeMiddleware(stack[i]);
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
              // Can module somehow be supplied by the developer?
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
        throw new Error("You must provide an Express app object so Samsaara can attach its authentication route");
      }
    }

    sockjsServer.installHandlers( server, { prefix: sockjsOpts._pathTo } );

    sockjsServer.on('connection', function (conn){
      connectionController.createNewConnection(conn);
    });

  };


  function initializeMiddleware(middleware){

    var moduleObject = middleware(module);
    var objName;

    if(moduleObject.name){
      if(!module[moduleObject.name]){
        module[moduleObject.name] = {};
      }
    }

    if(moduleObject.foundation){
      for(objName in moduleObject.foundation){
        if(!module[objName]){
          console.log("INITIALIZING foundation method", objName);
          if(moduleObject.name){
            module[moduleObject.name][objName] = moduleObject.foundation[objName];
          }
          module[objName] = moduleObject.foundation[objName];
        }
        else{
          throw new Error("Foundation method: " + objName + " is already an internal method on samsaara");
        }        
      }
    }

    if(moduleObject.remoteMethods){
      if(!module.nameSpaces.internal[objName]){
        for(objName in moduleObject.remoteMethods){
          module.nameSpaces.internal[objName] = moduleObject.remoteMethods[objName];
        }
      }
      else{
        throw new Error("Remote method: " + objName + " is already an internal method on samsaara");
      }
    }

    if(moduleObject.connectionInitialization){
      // console.log("connectionController", connectionController);
      for(objName in moduleObject.connectionInitialization){
        connectionController.Connection.prototype.initializationMethods.push(moduleObject.connectionInitialization[objName]);
      }
    }

    if(moduleObject.connectionClose){
      for(objName in moduleObject.connectionClose){
        connectionController.Connection.prototype.closingMethods.push(moduleObject.connectionClose[objName]);
      }
    }
  }

})(samsaara);


