/*!
 * Samsaara Middleware Loader
 * Copyright(c) 2013-2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var debug = require('debug')('samsaara:middleware');


var middleware = {};



function initialize(samsaaraCore, modules){


  (function middleware(module){

    var samsaaraConnection = require('../models/connection');

    var core = samsaaraCore;
    var samsaara = samsaaraCore.samsaara;

    var communication = samsaaraCore.communication;
    var connectionController = samsaaraCore.connectionController;
    var router = samsaaraCore.router;

    var constructors = samsaaraCore.constructors;

    var serverStack = modules.serverStack;
    var clientStack = modules.clientStack;

    var finishedStack = [];


    module.load = function(){
      for (var i = 0; i < serverStack.length; i++) {
        initializeModule(serverStack[i]);
      }
      for (var j = 0; j < finishedStack.length; j++) {
        finalizeModule(finishedStack[j]);
      }
    };


    module.new = function(newMiddleware){
      serverStack.push(newMiddleware);
    };


    // Plugs in middleware methods throughout samsaara

    function finalizeModule(middlewareExport){
      if(typeof middlewareExport.finalize === "function"){
        middlewareExport.finalize();
      }
    }


    function initializeModule(middleware){

      var e = middleware(core);
      var moduleName = e.name;

      finishedStack.push(e);


      // Gives samsaara a namespace for the module. (ie. samsaara.groups, samsaara.authentication etc.)

      if(moduleName){

        samsaaraCore.capability[moduleName] = true;

        if(!samsaaraCore[moduleName]){
          samsaaraCore[moduleName] = {};
        }
      }
      else{
        throw new Error("samsaara middleware requires a name");
      }


      // begin module integration

      if(e.moduleExports){
        initializeExportedObjects(moduleName, e.moduleExports);
      }

      if(e.main){
        initializeBaseObjects(moduleName, e.main);
      }

      if(e.constructors){
        initializeConstructors(moduleName, e.constructors);
      }

      if(e.clientScript){
        initializeClientScript(e.clientScript);
      }

      if(e.remoteMethods){
        initializeRemoteMethods(moduleName, e.remoteMethods);
      }

      if(e.connectionPreInitialization){
        connectionPreInitializationMethods(moduleName, e.connectionPreInitialization);
      }

      if(e.connectionInitialization){
        connectionInitializationMethods(moduleName, e.connectionInitialization);
      }

      if(e.connectionClose){
        connectionCloseMethods(moduleName, e.connectionClose);
      }

      if(e.preRouteFilters){
        preRouteFilterMethods(moduleName, e.preRouteFilters);
      }

      if(e.messageRoutes){
        addMessageRoutes(moduleName, e.messageRoutes);
      }      

      debug("Samsaara middleware module", e.name, "...Loaded");

    }


    // Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

    function addMessageRoutes(moduleName, routes){
      for(var route in routes){
        samsaaraCore.router.messageRoutes[route] = routes[route];
      }
    }


    // Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

    function preRouteFilterMethods(moduleName, methods){
      for(var objName in methods){
        samsaaraCore.router.preRouteFilters.push(methods[objName]);
      }
    }


    // Adds client script files for minifying.

    function initializeClientScript(script){

      if(typeof script === "string"){
        clientStack.push(script);
      }
      else{
        for(var i=0; i<script.length; i++){
          clientStack.push(script);
        }
      }
    }


    // Adds new methods in the middleware to the core samsaara object as well as the module's namespace.

    function initializeExportedObjects(moduleName, objects){

      for(var object in objects){
        if(moduleName){
          samsaaraCore[moduleName][object] = objects[object];
        }
      }
    }


    function initializeBaseObjects(moduleName, objects){

      for(var object in objects){
        if(!samsaara[object]){
          samsaara[object] = objects[object];
        }
        else{
          throw new Error("Foundation method or object: " + object + " is already an internal object or method name on samsaara");
        }
      }
    }

    function initializeConstructors(moduleName, constructors){

      for(var constructor in constructors){
        samsaaraCore.constructors[constructor] = constructors[constructor];
      }
    }

    
    // Adds remotely accessible methods to samsaara's internal namespace. (Should be configurable)
    
    function initializeRemoteMethods(moduleName, methods){
      samsaara.nameSpace("internal").expose(methods);
    }


    // Adds methods to execute when a new connection is formed.

    function connectionPreInitializationMethods(moduleName, methods){

      for(var objName in methods){
        // debug("The Connection Controller Object", connectionController);
        samsaaraConnection.preInitializationMethods.push(methods[objName]);
      }
    }


    // Adds methods to execute when a new connection is formed.

    function connectionInitializationMethods(moduleName, methods){

      for(var objName in methods){
        // debug("The Connection Controller Object", connectionController);
        samsaaraConnection.initializationMethods.push(methods[objName]);
      }
    }


    // Adds methods to execute when a connection is closed.

    function connectionCloseMethods(moduleName, methods){

      for(var objName in methods){
        samsaaraConnection.closingMethods.push(methods[objName]);
      }
    }


  })(middleware);


  return middleware;


}





exports = module.exports = {
  initialize: initialize
};

