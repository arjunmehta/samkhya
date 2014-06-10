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
var helper = require('./lib/helper');
var EventEmitter = require('events').EventEmitter;


// set up websocket abstraction (currently sockjs)

var sockjs = require('sockjs');
var sockjsOpts = { socketPath: "/samsaarasocket" };
var sockjsServer = sockjs.createServer();


// set up modules and middleware loader

var modules = {
  serverStack: [],
  clientStack: []
};

var expressApp;


var samsaara = new EventEmitter();


// set up core object variables
//
// the "core" object is a _complete_ object that is passed to middleware
// that gives them access to all core objects. while shielding access from the
// main module.

var core = {
  samsaara: samsaara,
  uuid: helper.makeIdAlphaNumerical(8), // the uuid can change at any time. Keep that in mind.
  constructors: {},
  capability: {}
};


// build up core

core.connectionController = require('./lib/connections').initialize(core);
core.communication = require('./lib/communication').initialize(core);
core.router = require('./lib/router').initialize(core);

core.constructors.Connection = require('./models/connection').initialize(core);
core.constructors.NameSpace = require('./models/namespace').initialize(core);
core.constructors.IncomingCallBack = require('./models/callback').initialize(core);


// surface main public methods from core modules

samsaara.connection = core.connectionController.connection;
samsaara.nameSpace = core.communication.nameSpace;
samsaara.createNamespace = core.communication.createNamespace;
samsaara.expose = core.communication.expose;


// initialize middleware module

var middleware = require('./lib/middleware').initialize(core, modules);


// add routes & scripts (for concatenation into main client script)

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


// middleware loader

samsaara.use = core.use = function(module){
  modules.serverStack.push(module);
  return this;
};


// initialize everything

samsaara.initialize = function (server, app, options){


  // copy options to config, and set other base options

  if(options){
    core.options = options;
    sockjsOpts.socketPath = options.socketPath || "/samsaarasocket";
  }


  // configure app routes and base client files

  if(app){
    expressApp = app;

    addClientFileRoute("samsaaraCore.js", __dirname + '/client/samsaara.js');
    addClientFileRoute("sockjs.js", __dirname + '/client/sockjs-0.3.min.js');
    addClientFileRoute("ee.js", __dirname + '/client/EventEmitter.min.js');

    addClientScript(__dirname + '/node_modules/debug/debugweb.js');
    addClientScript(__dirname + '/client/EventEmitter.min.js');
    addClientScript(__dirname + '/client/sockjs-0.3.min.js');
    addClientScript(__dirname + '/client/samsaara.js');
  }
  else{
    throw new Error("You must provide an (express) app object so samsaara can attach its routes");
  }


  // load/build in middleware

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


exports = module.exports = samsaara;
