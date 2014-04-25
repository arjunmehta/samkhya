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
    switchContext: this.contextController.switchContext,
    linkContext: this.contextController.linkContext,
    clearFromContext: this.contextController.clearFromContext,

    addUserSession: this.authentication.addUserSession,
    removeUserSession: this.authentication.removeUserSession,

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
    requestRegistrationToken: this.authentication.requestRegistrationToken
  });

  this.expose({
    switchContext: this.contextController.switchContext
  }, "samsaara");
    
}






//EVENT EMITTER PROTOTYPE
Samsaara.prototype.__proto__ = EventEmitter.prototype;




//MAIN CONTROLLER FUNCTION////////////////////////////////////////////////////////////////////////////
Samsaara.prototype.initialize = function (server, app, opts){

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

      if(opts.redisPub && opts.redisSub && opts.redisClient){
        this.pub = opts.redisPub;
        this.sub = opts.redisSub;
        this.client = opts.redisClient;
      }
      else{
        throw "RedisClient for redisPub, redisSub and redisClient must be provided in order for samsaara to work using Redis.";
      }

      this.comStore.initialize(this, this.pub, this.sub, this.client);

    }
    else{
      this.comStore = require('./lib/communication-memory.js');
      this.comStore.initialize(this);
    }

    this.contextController.setRedisStore(true);
    this.authentication.setRedisStore(true);

    for(var func in this.authentication.exported){
      this[func] = this.authentication.exported[func];
    }

    if(app){

      app.get('/samsaara/samsaara.js', function (req, res){
        res.sendfile(__dirname + '/client/samsaara.js');
      });

      app.get('/samsaara/sockjs.js', function (req, res){
        res.sendfile(__dirname + '/client/sockjs-0.3.min.js');
      });

      app.get('/samsaara/ee.js', function (req, res){
        res.sendfile(__dirname + '/client/EventEmitter.min.js');
      });

      app.get('/registerSamsaaraConnection', function (req, res) {

        var registrationToken = req.query.regtoken;

        self.authentication.retrieveRegistrationToken(registrationToken, function (err, reply){
          if(err === null){
            // Can this somehow be supplied by the developer?
            self.authentication.getRequestSessionInfo(req.sessionID, function (sessionID, userID){              
              var keyObject = { sessionID: sessionID, userID: userID, tokenKey: reply };
              res.send(keyObject);
            });
          }
          else{
            res.send({ err: err });
          }
        });
      });
    }
    else{
      throw "You must provide an Express app object so Samsaara can attach its authentication route";
    }
  }

  self.sockjsServer.installHandlers( server, { prefix: sockjsOpts._pathTo } );

  self.sockjsServer.on('connection', function (conn){
    self.connectionController.createNewConnection(conn);
  });
};




