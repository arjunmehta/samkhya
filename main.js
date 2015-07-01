// samsaara
// Copyright(c) 2013-2015 Arjun Mehta <arjun@arjunmehta.net>
// MIT Licensed


var EventEmitter = require('events').EventEmitter;
var util = require('util');

var uuid = require('utils/util.js').createPseudoUuid(8);

var transport,

    connectionController,
    communicationController,
    routeController,
    middlewareLoader,

    Connection = require('./models/connection'),
    NameSpace = require('./models/namespace'),
    IncomingCallBack = require('./models/callback');


util.inherits(Samsaara, EventEmitter);


function Samsaara() {

    EventEmitter.call(this);

    connectionController = require('./lib/connectionController')(uuid);
    communicationController = require('./lib/communicationController')(uuid, this, connectionController);
    routeController = require('./lib/routeController')(uuid, communicationController);
    middlewareLoader = require('./lib/middlewareLoader')(this, connectionController, communicationController, routeController);

    Connection.initialize(uuid, this, communicationController, connectionController, routeController);
    NameSpace.initialize(this);
    IncomingCallBack.initialize(this);

    this.capability = {};
    this.connection = connectionController.connection;
    this.nameSpace = communicationController.nameSpace;
    this.createNamespace = communicationController.createNamespace;
    this.expose = communicationController.expose;
    this.use = middlewareLoader.use;
}

Samsaara.prototype.initialize = function(opts) {

    opts = opts || {};
    middleware.load();
    transport = opts.socket;

    transport.on('connection', function(conn) {
        connectionController.createConnection(conn);
    });

    return this;
};


module.exports = new Samsaara();
