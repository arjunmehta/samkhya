/*!
 * samsaara
 *
 * Copyright(c) 2013-2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


// load dependencies

var debug = require('debug')('samsaara:index');

var fs = require('fs');
var uglify = require("uglify-js");

var EventEmitter = require('events').EventEmitter;
var samsaara = new EventEmitter();


// export and build core object

exports = module.exports = samsaara;

samsaara = (function Samsaara(module){


  // set up core object variables

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


  // add routes & scripts (for concatenation into main client script)

  var addClientScript = module.addClientScript = function(filePath){
    clientStack.push(filePath);
  };

  var addClientFileRoute = module.addClientFileRoute = function(filename, filePath){
    expressApp.get('/samsaara/'+filename, function (req, res){
      res.sendfile(filePath);
    });
  };

  var addClientGetRoute = module.addClientGetRoute = function(route, method){
    expressApp.get(route, method);
  };


  // middleware loader

  module.use = function(newMiddleware){
    stack.push(newMiddleware);
    return this;
  };


  // initialize everything

  module.initialize = function (server, app, opts){


    // copy options to config, and set other base options

    if(opts){
      config.options = opts;
      sockjsOpts.socketPath = opts.socketPath || "/echo";
    }


    // configure app routes and base client files

    if(app){
      expressApp = app;

      addClientFileRoute("samsaaraCore.js", __dirname + '/client/samsaara.js');
      addClientFileRoute("sockjs.js", __dirname + '/client/sockjs-0.3.min.js');
      addClientFileRoute("ee.js", __dirname + '/client/EventEmitter.min.js');

      addClientScript(__dirname + '/node_modules/debug/debug.js');
      addClientScript(__dirname + '/client/EventEmitter.min.js');
      addClientScript(__dirname + '/client/sockjs-0.3.min.js');
      addClientScript(__dirname + '/client/samsaara.js');
    }
    else{
      throw new Error("You must provide an Express app object so Samsaara can attach its routes");
    }


    // load core submodules

    connectionController = module.connectionController = require('./lib/connectionController');
    communication = module.communication = require('./lib/communication');
    router = module.router = require('./lib/router');


    // bring certain methods from submodules to root

    var bringToMain = {
      connection: connectionController.connection,

      nameSpace: communication.nameSpace,
      createNamespace: communication.createNamespace,
      expose: communication.expose
    };

    for(var func in bringToMain){
      module[func] = bringToMain[func];
    }

    module.constructors = {
      IncomingCallBack: communication.IncomingCallBack,
      NameSpace: communication.NameSpace
    };


    // initialize middleware

    middleware.initialize(module, stack, clientStack);


    // generate a concatenated and minified client script file for core and all submodules

    var clientUglified = uglify.minify(clientStack);
    var clientFilePath = __dirname + '/client/samsaara.min.js';

    fs.writeFile(clientFilePath, clientUglified.code, function (err){

      if(err) {
        debug(err);
      } else {
        debug("Samsaara client script generated and saved:", clientFilePath);
        addClientFileRoute("samsaara.js", clientFilePath);
      }      


      // open up socket port and listen for new connections

      sockjsServer.installHandlers( server, { prefix: sockjsOpts.socketPath } );

      sockjsServer.on('connection', function (socketConnection){
        connectionController.createNewConnection(socketConnection);
      });

    });

  };

})(samsaara);


