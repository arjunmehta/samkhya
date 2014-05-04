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

  var sockjs = require('sockjs');  
  var sockjsOpts = { socketPath: "/echo" };
  var sockjsServer = sockjs.createServer();

  var connectionController = module.connectionController = require('./lib/connectionController.js');  
  var communication = module.communication = require('./lib/communication.js');

  // var authentication = require('./lib/authentication.js');

  var stack = [];

  var bringToMain = {
    connections: connectionController.connections,

    nameSpaces: communication.nameSpaces,
    expose: communication.expose,
    exposeNamespace: communication.exposeNamespace,

    sendToClient: communication.sendToClient,
  };

  for(var func in bringToMain){
    module[func] = bringToMain[func];
  }

  module.nameSpaces.internal = {
    windowResize: connectionController.windowResize,
    geoPosition: connectionController.geoPosition,
    callItBack: communication.callItBack,
    callItBackError: communication.callItBackError,
    // requestRegistrationToken: authentication.requestRegistrationToken
  };

  module.use = function(middleware){
    // console.log("NEW MIDDLEWARE", middleware);
    stack.push(middleware);
  };

  module.initialize = function (server, app, opts){

    if(opts){

      config.options = opts;
      sockjsOpts.socketPath = opts.socketPath || "/echo";

      // if(opts.redisStore){   

      //   if(opts.redisPub && opts.redisSub && opts.redisClient){
      //     config.redisStore = true;
      //     config.redisPub = opts.redisPub;
      //     config.redisSub = opts.redisSub;
      //     config.redisClient = opts.redisClient;

      //     config.redisClient.get("specialKey", function(err, reply){
      //       config.specialKey = reply;
      //     });
      //   }
      //   else{
      //     throw new Error("RedisClient for redisPub, redisSub and redisClient must be provided in order for samsaara to work using Redis.");
      //   }
      // }

      // for(var func in authentication.exported){
      //   module[func] = authentication.exported[func];
      // }

      // console.log("MIDDLE WARE STACK ", JSON.stringify(stack));

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

    sockjsServer.installHandlers( server, { prefix: sockjsOpts.socketPath } );

    sockjsServer.on('connection', function (conn){
      connectionController.createNewConnection(conn);
    });

  };


  function initializeMiddleware(middleware){

    var middlewareExported = middleware(module);
    var moduleName = middlewareExported.name;
    var objName;

    console.log("Module", middlewareExported.name, "Loaded");

    if(moduleName){
      if(!module[moduleName]){
        module[moduleName] = {};
      }
    }

    if(middlewareExported.foundationMethods){
      initializeFoundationMethods(moduleName, middlewareExported.foundationMethods);
    }

    if(middlewareExported.remoteMethods){
      initializeRemoteMethods(moduleName, middlewareExported.remoteMethods);
    }

    if(middlewareExported.connectionInitialization){
      // console.log("connectionController", connectionController);
      connectionInitializationMethods(moduleName, middlewareExported.connectionInitialization);
    }

    if(middlewareExported.connectionClose){
      connectionCloseMethods(moduleName, middlewareExported.connectionClose);
    }
  }


  function initializeFoundationMethods(moduleName, methods){

    for(var objName in methods){
      if(!module[objName]){
        // console.log("INITIALIZING foundationMethods method", objName);
        if(moduleName){
          module[moduleName][objName] = methods[objName];
        }
        module[objName] = methods[objName];
      }
      else{
        throw new Error("Foundation method: " + objName + " is already an internal method on samsaara");
      }        
    }
  }


  function initializeRemoteMethods(moduleName, methods){
      
    for(var objName in methods){
      if(!module.nameSpaces.internal[objName]){
        module.nameSpaces.internal[objName] = methods[objName];
      }
      else{
        throw new Error("Remote method: " + objName + " is already an internal method on samsaara");
      }
    }     
  }

  function connectionInitializationMethods(moduleName, methods){
      
    for(var objName in methods){
      // console.log("The Connection Controller Object", connectionController);
      connectionController.Connection.prototype.initializationMethods.push(methods[objName]);
    }
  }

  function connectionCloseMethods(moduleName, methods){
      
    for(var objName in methods){
      connectionController.Connection.prototype.closingMethods.push(methods[objName]);
    }     
  }


})(samsaara);


