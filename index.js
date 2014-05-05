/*!
 * Samsaara
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var log = require("./lib/log");
var helper = require('./lib/helper');

var EventEmitter = require('events').EventEmitter;

var samsaara = new EventEmitter();

exports = module.exports = samsaara;


/**
 * samsaara Core Object
 */

samsaara = (function Samsaara(module){
 
  var config = module.config = require('./lib/config');

  var sockjs = require('sockjs');  
  var sockjsOpts = { socketPath: "/echo" };
  var sockjsServer = sockjs.createServer();

  var expressApp,
      connectionController,
      communication,
      router;

  var stack = [];


  /**
   * Middleware loader
   */

  module.use = function(middleware){
    // console.log("NEW MIDDLEWARE", middleware);
    stack.push(middleware);
  };

  var addClientFileRoute = module.addClientFileRoute = function(filename, filePath){

    console.log("SETTING UP ROUTE");

    expressApp.get('/samsaara/'+filename, function (req, res){
      res.sendfile(filePath);
    });
  };

  var addClientGetRoute = module.addClientGetRoute = function(route, method){
    expressApp.get(route, method);
  };

  /**
   * Initialize everything
   */

  module.initialize = function (server, app, opts){

    if(opts){

      config.options = opts;
      sockjsOpts.socketPath = opts.socketPath || "/echo";

      if(app){

        expressApp = app;

        addClientFileRoute("samsaara.js", __dirname + '/client/samsaara.js');
        addClientFileRoute("sockjs.js", __dirname + '/client/sockjs-0.3.min.js');
        addClientFileRoute("ee.js", __dirname + '/client/EventEmitter.min.js');

      }
      else{
        throw new Error("You must provide an Express app object so Samsaara can attach its routes");
      }
    }

    connectionController = module.connectionController = require('./lib/connectionController');  
    communication = module.communication = require('./lib/communication');     
    router = module.router = require('./lib/router');     
    
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

    for (var i = 0; i < stack.length; i++) {
      initializeMiddleware(stack[i]);
    } 


    sockjsServer.installHandlers( server, { prefix: sockjsOpts.socketPath } );

    sockjsServer.on('connection', function (conn){
      connectionController.createNewConnection(conn);
    });

  };


  /**
   * Plugs in middleware methods throughout samsaara
   */

  function initializeMiddleware(middleware){

    var middlewareExports = middleware(module);
    var moduleName = middlewareExports.name;
    var objName;

    console.log("Module", middlewareExports.name, "Loaded");

    if(moduleName){
      if(!module[moduleName]){
        module[moduleName] = {};
      }
    }

    if(middlewareExports.foundationMethods){
      initializeFoundationMethods(moduleName, middlewareExports.foundationMethods);
    }

    if(middlewareExports.remoteMethods){
      initializeRemoteMethods(moduleName, middlewareExports.remoteMethods);
    }

    if(middlewareExports.connectionInitialization){
      // console.log("connectionController", connectionController);
      connectionInitializationMethods(moduleName, middlewareExports.connectionInitialization);
    }

    if(middlewareExports.connectionClose){
      connectionCloseMethods(moduleName, middlewareExports.connectionClose);
    }

    if(middlewareExports.preRouteFilters){
      preRouteFilterMethods(moduleName, middlewareExports.preRouteFilters);
    }

    if(middlewareExports.routeMessageOverride && typeof middlewareExports.routeMessageOverride === "function"){
      routeMessageOverride(moduleName, middlewareExports.routeMessageOverride);
    }

  }


  function preRouteFilterMethods(moduleName, methods){
    for(var objName in methods){
      router.preRouteFilters.push(methods[objName]);
    }
  }

  function routeMessageOverride(moduleName, method){
    router.routeMessage = method;
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
        // console.log("initializeRemoteMethods adding new remote methods", objName, module.nameSpaces.internal);
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


