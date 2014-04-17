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
    sendToGroup: this.communication.sendToGroup,

    contexts: this.contextController.contexts,
    openContext: this.contextController.openContext,
    openContextWithData: this.contextController.openContextWithData,
    isContextOpen: this.contextController.isContextOpen,
    addToForeignContext: this.contextController.addToForeignContext,
    switchContext: this.contextController.switchContext,
    linkContext: this.contextController.linkContext,
    addToLocalContext: this.contextController.addToLocalContext,
    clearFromContext: this.contextController.clearFromContext,

    Context: this.contextController.Context,
    Access: this.contextController.Access,
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

  // Initialize Models
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

    if(opts.app){
      opts.app.get('/samsaara/samsaara.js', function (req, res){
        res.sendfile(__dirname + '/client/samsaara.js');
      });
      opts.app.get('/samsaara/sockjs.js', function (req, res){
        res.sendfile(__dirname + '/client/sockjs-0.3.min.js');
      });

    }

  }

  self.sockjsServer.installHandlers( server, { prefix: sockjsOpts._pathTo } );

  self.sockjsServer.on('connection', function (conn){
    self.connectionController.createNewConnection(conn);
  });
};




