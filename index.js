/*!
 * Samsaara
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var log = require("./lib/log.js");

var sockjs = require('sockjs');
var EventEmitter = require('events').EventEmitter;

var helper = require('./lib/helper.js');
var config = require('./lib/config.js');

var self;

exports = module.exports = new Samsaara();



//ROOT ARGYLE OBJECT////////////////////////////////////////////////////////////////////////////
function Samsaara(){

  self = this;
  
  this.config = config;

  config.options = {
    pathTo: "/echo"
  };


  this.whateverTestFunction = function(argA, argB, callBack){

    console.log("////////////////////////EXECUTING TEXT FUNCTION");
    console.log("////////////////////////EXECUTING TEXT FUNCTION");
    console.log("////////////////////////EXECUTING TEXT FUNCTION");
    console.log("////////////////////////EXECUTING TEXT FUNCTION");
    console.log("////////////////////////EXECUTING TEXT FUNCTION");
    console.log("////////////////////////EXECUTING TEXT FUNCTION");
    console.log("argA:", argA);
    console.log("argB:", argB);
    argB.push("A NEW ONEEEEE");
    argB.push(null);
    argB.push({gwenda: "aljkhakja", anArray: ["ajkhakha"]});
    if(callBack && typeof callBack == "function") callBack(argA, argB);

  };


  this.sockjsServer = sockjs.createServer();

  // require and initialize connection controller
  this.connectionController = require('./lib/connectionController.js');
  this.connectionController.initialize(this);

  // require and initialize communication controller
  this.communication = require('./lib/communication.js');
  this.communication.initialize(this);

  // require and initialize authentication controller
  this.authentication = require('./lib/authentication.js');
  this.authentication.initialize(this);
 
  // require and initialize context controller
  this.contextController = require('./lib/contextController.js'); 
  this.contextController.initialize(this);

  // require and initialize grouping and namespace controller
  this.grouping = require('./lib/grouping.js');
  this.grouping.initialize(this);

  var bringToMain = {
    connections: this.connectionController.connections,
    sendTo: this.communication.sendTo,

    contexts: this.contextController.contexts,
    openContext: this.contextController.openContext,
    isContextOpen: this.contextController.isContextOpen,
    addToForeignContext: this.contextController.addToForeignContext,
    switchContext: this.contextController.switchContext,
    linkContext: this.contextController.linkContext,
    addToLocalContext: this.contextController.addToLocalContext,
    clearFromContext: this.contextController.clearFromContext,

    Context: this.contextController.Context,
    Connection: this.connectionController.Connection,

    groups: this.grouping.groups,
    createGroup: this.grouping.createGroup,
    inGroup: this.grouping.inGroup,
    addToGroup: this.grouping.addToGroup,
    removeFromGroup: this.grouping.removeFromGroup,
    expose: this.grouping.expose,
    exposeNamespace: this.grouping.exposeNamespace
  };
  for(var func in bringToMain){
    this[func] = bringToMain[func];
  }

  this.Context.initialize(this);
  this.Connection.initialize(this);

  this.expose({
    windowResize: this.connectionController.windowResize,
    geoPosition: this.connectionController.geoPosition,
    callItBack: this.communication.callItBack,
    requestLoginToken: this.authentication.requestLoginToken,
    whateverTestFunction: this.whateverTestFunction
  });

  this.expose({
    switchContext: this.contextController.switchContext
  }, "samsaara");
    
}






//EVENTEMITTER PROTOTYPE
// Samsaara.prototype.__proto__ = EventEmitter.prototype;
Samsaara.prototype.__proto__ = EventEmitter.prototype;




//MAIN CONTROLLER FUNCTION////////////////////////////////////////////////////////////////////////////
Samsaara.prototype.initialize = function (server, opts){

  var sockjsOpts = { _pathTo: "/echo" };

  if(opts){
    config.options = opts;

    if(opts.pathTo){
      sockjsOpts._pathTo = opts.pathTo;
      log.info("setting opts.pathTo", sockjsOpts._pathTo);
    }

    if(opts.redisStore){
      this.comStore = require('./lib/communication-redis.js');
      log.info("setting opts.redisStore");

      // initialize a pubsub client and a regular client
      if(opts.redisPub){
        this.pub = opts.redisPub;
      }
      if(opts.redisSub){
        this.sub = opts.redisSub;
      }
      if(opts.redisClient){
        this.client = opts.redisClient;
      }

      this.comStore.initialize(this, this.pub, this.sub, this.client);

    }
    else{
      this.comStore = require('./lib/communication-memory.js');
      this.comStore.initialize(this);
    }

    if(opts.couchStore){
      require('./lib/database.js')(this, opts.usersDB, opts.contextsDB);
    }
  }

  self.sockjsServer.installHandlers( server, { prefix: sockjsOpts._pathTo } );

  self.sockjsServer.on('connection', function (conn){
    self.connectionController.createNewConnection(conn);
  });
};




