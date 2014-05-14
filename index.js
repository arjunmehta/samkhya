/*!
 * Samsaara
 * Copyright(c) 2013-2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:index');

var fs = require('fs');
var UglifyJS = require("uglify-js");

var EventEmitter = require('events').EventEmitter;
var samsaara = new EventEmitter();

exports = module.exports = samsaara;


/**
 * samsaara Core Object
 */

samsaara = (function Samsaara(module){

  var expressApp,
      connectionController,
      communication,      
      router;

  var middleware = require('./lib/middleware');
  var config = module.config = require('./lib/config');

  var sockjs = require('sockjs');
  var sockjsOpts = { socketPath: "/echo" };
  var sockjsServer = sockjs.createServer();

  var stack = [];
  var clientStack = [];


  /**
   * Middleware loader
   */

  module.use = function(newMiddleware){
    stack.push(newMiddleware);
    return this;
  };

  var addClientFileRoute = module.addClientFileRoute = function(filename, filePath){
    expressApp.get('/samsaara/'+filename, function (req, res){
      res.sendfile(filePath);
    });
  };

  var addClientScript = module.addClientScript = function(filePath){
    clientStack.push(filePath);
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
    }

    if(app){
      expressApp = app;

      addClientFileRoute("samsaaraCore.js", __dirname + '/client/samsaara.js');
      addClientFileRoute("sockjs.js", __dirname + '/client/sockjs-0.3.min.js');
      addClientFileRoute("ee.js", __dirname + '/client/EventEmitter.min.js');

      addClientScript(__dirname + '/client/EventEmitter.min.js');
      addClientScript(__dirname + '/client/sockjs-0.3.min.js');
      addClientScript(__dirname + '/client/samsaara.js');
    }
    else{
      throw new Error("You must provide an Express app object so Samsaara can attach its routes");
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

    middleware.initialize(module, stack, clientStack);

    var clientUglified = UglifyJS.minify(clientStack);
    var clientFilePath = __dirname + '/client/samsaara.min.js';

    fs.writeFile(clientFilePath, clientUglified.code, function (err){

      if(err) {
        debug(err);
      } else {
        debug("Samsaara client script generated and saved:", clientFilePath);
        addClientFileRoute("samsaara.js", clientFilePath);
      }      

      sockjsServer.installHandlers( server, { prefix: sockjsOpts.socketPath } );

      sockjsServer.on('connection', function (socketConnection){
        connectionController.createNewConnection(socketConnection);
      });

    });

  };

})(samsaara);


