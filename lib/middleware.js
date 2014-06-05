/*!
 * Samsaara Middleware Loader
 * Copyright(c) 2013-2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var debug = require('debug')('samsaara:middleware');


var middleware = {};

var core,
    samsaara,
    communication,
    connectionController,
    router,
    constructors;

var samsaaraConnection;

var serverStack,
    clientStack,
    finishedStack = [];


function initialize(samsaaraCore, modules){
  core = samsaaraCore;
  samsaara = samsaaraCore.samsaara;

  communication = samsaaraCore.communication;
  connectionController = samsaaraCore.connectionController;
  router = samsaaraCore.router;
  constructors = samsaaraCore.constructors;

  serverStack = modules.serverStack;
  clientStack = modules.clientStack;

  samsaaraConnection = require('../models/connection');

  return middleware;
}


middleware.load = function(){
  for (var i = 0; i < serverStack.length; i++) {
    initializeModule(serverStack[i]);
  }
  for (var j = 0; j < finishedStack.length; j++) {
    finalizeModule(finishedStack[j]);
  }
};


middleware.new = function(newMiddleware){
  serverStack.push(newMiddleware);
};


function initializeModule(middleware){

  var e = middleware(core);
  var moduleName = e.name;

  finishedStack.push(moduleName, e);


  // Gives samsaara a namespace for the middleware. (ie. samsaara.groups, samsaara.authentication etc.)

  if(moduleName){

    core.capability[moduleName] = true;

    if(!core[moduleName]){
      core[moduleName] = {};
    }
  }
  else{
    throw new Error("samsaara middleware requires a name");
  }


  // begin module integration

  initializeExportedObjects(moduleName, e);
  initializeMainObjects(moduleName, e);

  initializeClientScript(moduleName, e);
  initializeRemoteMethods(moduleName, e);

  connectionPreInitializationMethods(moduleName, e);
  connectionInitializationMethods(moduleName, e);
  connectionCloseMethods(moduleName, e);

  preRouteFilterMethods(moduleName, e);
  addMessageRoutes(moduleName, e);

  initializeConstructors(moduleName, e);

  debug("Samsaara middleware module", e.name, "...Loaded");

}


// Plugs in middleware methods throughout samsaara

function finalizeModule(middlewareExport){
  if(typeof middlewareExport.finalize === "function"){
    middlewareExport.finalize();
  }
}


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

function addMessageRoutes(moduleName, e){

  var routes = e.messageRoutes;

  for(var route in routes){
    core.router.messageRoutes[route] = routes[route];
  }
}


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

function preRouteFilterMethods(moduleName, e){

  var methods = e.preRouteFilters;

  for(var objName in methods){
    core.router.preRouteFilters.push(methods[objName]);
  }
}


// Adds client script files for minifying.

function initializeClientScript(moduleName, e){

  var script = e.clientScript;

  if(script){
    if(typeof script === "string"){
      clientStack.push(script);
    }
    else{
      for(var i=0; i<script.length; i++){
        clientStack.push(script);
      }
    }
  }
}


// Adds new methods in the middleware to the core samsaara object as well as the module's namespace.

function initializeExportedObjects(moduleName, e){

  var objects = e.moduleExports;


  for(var object in objects){
    if(moduleName){
      core[moduleName][object] = objects[object];
    }
  }
}


function initializeMainObjects(moduleName, e){

  var objects = e.main;

  for(var object in objects){
    if(!samsaara[object]){
      samsaara[object] = objects[object];
    }
    else{
      throw new Error("Foundation method or object: " + object + " is already an internal object or method name on samsaara");
    }
  }
}


function initializeConstructors(moduleName, e){

  var constructors = e.constructors;

  for(var constructor in constructors){
    core.constructors[constructor] = constructors[constructor];
  }
}


// Adds remotely accessible methods to samsaara's internal namespace. (Should be configurable)

function initializeRemoteMethods(moduleName, e){

  var methods = e.remoteMethods;
  samsaara.nameSpace("internal").expose(methods);
}


// Adds methods to execute when a new connection is formed.

function connectionPreInitializationMethods(moduleName, e){

  var methods = e.connectionPreInitialization;

  for(var objName in methods){
    samsaaraConnection.preInitializationMethods.push(methods[objName]);
  }
}


// Adds methods to execute when a new connection is formed.

function connectionInitializationMethods(moduleName, e){

  var methods = e.connectionInitialization;

  for(var objName in methods){
    samsaaraConnection.initializationMethods.push(methods[objName]);
  }
}


// Adds methods to execute when a connection is closed.

function connectionCloseMethods(moduleName, e){

  var methods = e.connectionClose;

  for(var objName in methods){
    samsaaraConnection.closingMethods.push(methods[objName]);
  }
}



exports = module.exports = {
  initialize: initialize
};

