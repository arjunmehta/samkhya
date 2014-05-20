/*!
 * samsaara
 *
 * Copyright(c) 2013-2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


// load dependencies

var debug = require('debug')('samsaara:index');
var helper = require('./lib/helper');

var fs = require('fs');
var uglify = require("uglify-js");


// build and export an object (a new EventEmitter)

var EventEmitter = require('events').EventEmitter;
var samsaara = new EventEmitter();

exports = module.exports = samsaara;


// augment exported module

(function Samsaara(module){


  // set up core object variables
  // the core object is a "complete" object that is passed to middleware
  // for greater flexibility in modifying functionality

  var core = {
    samsaara: module,
    uuid: helper.makeIdAlphaNumerical(8),
    constructors: {},
    capability: {}
  };

  core.connectionController = require('./lib/connectionController').initialize(core);
  core.communication = require('./lib/communication').initialize(core);
  core.router = require('./lib/router').initialize(core);

  core.constructors.Connection = require('./models/connection').initialize(core);
  core.constructors.NameSpace = require('./models/namespace').initialize(core);
  core.constructors.IncomingCallBack = require('./models/callback').initialize(core);


  // surface main public methods from core modules

  module.connection = core.connectionController.connection;
  module.nameSpace = core.communication.nameSpace;
  module.createNamespace = core.communication.createNamespace;
  module.expose = core.communication.expose;


  // set up modules and middleware

  var modules = {
    serverStack: [],
    clientStack: []
  };

  var middleware = require('./lib/middleware').initialize(core, modules);
  

  // add routes & scripts (for concatenation into main client script)

  var expressApp;  

  var addClientScript = core.addClientScript = function(filePath){
    modules.clientStack.push(filePath);
  };

  var addClientFileRoute = core.addClientFileRoute = function(filename, filePath){
    expressApp.get('/samsaara/'+filename, function (req, res){
      res.sendfile(filePath);
    });
  };

  var addClientGetRoute = core.addClientGetRoute = function(route, method){
    expressApp.get(route, method);
  };


  // set up socket abstraction (currently sockjs)

  var sockjs = require('sockjs');
  var sockjsOpts = { socketPath: "/echo" };
  var sockjsServer = sockjs.createServer();



  // middleware loader

  module.use = core.use = function(newMiddleware){
    modules.serverStack.push(newMiddleware);
    return this;
  };


  // initialize everything

  module.initialize = function (server, app, options){


    // copy options to config, and set other base options

    if(options){
      core.options = options;
      sockjsOpts.socketPath = options.socketPath || "/echo";
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
      throw new Error("You must provide an Express app object so samsaara can attach its routes");
    }


    // load middleware

    middleware.load();


    // generate a concatenated and minified client script file for core and all submodules

    var clientUglified = uglify.minify(modules.clientStack);
    var clientFilePath = __dirname + '/client/samsaara.min.js';

    fs.writeFileSync(clientFilePath, clientUglified.code);
    addClientFileRoute("samsaara.js", clientFilePath);


    // open up socket port and listen for new connections

    sockjsServer.installHandlers( server, { prefix: sockjsOpts.socketPath } );

    sockjsServer.on('connection', function (socketConnection){
      core.connectionController.createNewConnection(socketConnection);
    });


  };

})(samsaara);


