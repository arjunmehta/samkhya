/*!
 * Samsaara Middleware Loader
 * Copyright(c) 2013-2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var debug = require('debug')('samsaara:middleware');


var middleware = {};
exports = module.exports = middleware;


(function middleware(module){

  var samsaara,
      router,
      communication,
      connectionController;

  var samsaaraConnection = require('../models/connection');

  var stack;
  var clientStack;

  module.new = function(newMiddleware){
    stack.push(newMiddleware);
  };

  module.initialize = function(samsaaraCore, middlewareStack, middlewareClientStack){

    samsaara = samsaaraCore;
    communication = samsaara.communication;
    connectionController = samsaara.connectionController;
    router = samsaara.router;

    stack = middlewareStack;
    clientStack = middlewareClientStack;

    for (var i = 0; i < stack.length; i++) {
      initializeModule(stack[i]);
    }
  };


  /**
   * Plugs in middleware methods throughout samsaara
   */

  var initializeModule = module.initializeModule = function(middleware){

    var middlewareExports = middleware(samsaara);
    var moduleName = middlewareExports.name;
    var objName;

    /**
     * Gives samsaara a namespace for the module. (ie. samsaara.groups, samsaara.authentication etc.)
     */

    if(moduleName){
      if(!samsaara[moduleName]){
        samsaara[moduleName] = {};
      }
    }


    // server-side methods

    if(middlewareExports.foundationMethods){
      initializeFoundationMethods(moduleName, middlewareExports.foundationMethods);
    }


    // server/client interaction

    if(middlewareExports.clientScript){
      initializeClientScript(middlewareExports.clientScript);
    }

    if(middlewareExports.remoteMethods){
      initializeRemoteMethods(moduleName, middlewareExports.remoteMethods);
    }


    // connection handling

    if(middlewareExports.connectionPreInitialization){
      connectionPreInitializationMethods(moduleName, middlewareExports.connectionPreInitialization);
    }

    if(middlewareExports.connectionInitialization){
      connectionInitializationMethods(moduleName, middlewareExports.connectionInitialization);
    }

    if(middlewareExports.connectionClose){
      connectionCloseMethods(moduleName, middlewareExports.connectionClose);
    }


    // messaging

    if(middlewareExports.preRouteFilters){
      preRouteFilterMethods(moduleName, middlewareExports.preRouteFilters);
    }

    if(middlewareExports.routeMessageOverride && typeof middlewareExports.routeMessageOverride === "function"){
      routeMessageOverride(moduleName, middlewareExports.routeMessageOverride);
    }

    debug("Samsaara middleware module", middlewareExports.name, "...Loaded");

  };


  /**
   * Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).
   */

  function preRouteFilterMethods(moduleName, methods){
    for(var objName in methods){
      router.preRouteFilters.push(methods[objName]);
    }
  }


  /**
   * Overrides the router.js routeMessage method. Only one middleware can do this at a time (usually ipc).
   */

  function routeMessageOverride(moduleName, method){
    router.routeMessage = method;
  }


  /**
   * Adds client script files for minifying.
   */

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


  /**
   * Adds new methods in the middleware to the core samsaara object as well as the
   * module's namespace.
   */

  function initializeFoundationMethods(moduleName, methods){

    for(var objName in methods){
      if(!samsaara[objName]){
        // debug("INITIALIZING foundationMethods method", objName);
        if(moduleName){
          samsaara[moduleName][objName] = methods[objName];
        }
        samsaara[objName] = methods[objName];
      }
      else{
        throw new Error("Foundation method: " + objName + " is already an internal method on samsaara");
      }
    }
  }


  /**
   * Adds remotely accessible methods to samsaara's internal namespace. (Should be configurable)
   */

  function initializeRemoteMethods(moduleName, methods){

    for(var objName in methods){
      if(!communication.nameSpaces.internal[objName]){
        communication.nameSpaces.internal[objName] = methods[objName];
        // debug("initializeRemoteMethods adding new remote methods", objName, communication.nameSpaces.internal);
      }
      else{
        throw new Error("Remote method: " + objName + " is already an internal method on samsaara");
      }
    }
  }


  /**
   * Adds methods to execute when a new connection is formed.
   */

  function connectionPreInitializationMethods(moduleName, methods){

    for(var objName in methods){
      // debug("The Connection Controller Object", connectionController);
      samsaaraConnection.preInitializationMethods.push(methods[objName]);
    }
  }


  /**
   * Adds methods to execute when a new connection is formed.
   */

  function connectionInitializationMethods(moduleName, methods){

    for(var objName in methods){
      // debug("The Connection Controller Object", connectionController);
      samsaaraConnection.initializationMethods.push(methods[objName]);
    }
  }


  /**
   * Adds methods to execute when a connection is closed.
   */

  function connectionCloseMethods(moduleName, methods){

    for(var objName in methods){
      samsaaraConnection.closingMethods.push(methods[objName]);
    }
  }


})(middleware);
