// samsaara
// Copyright(c) 2013-2015 Arjun Mehta <arjun@arjunmehta.net>
// MIT Licensed


var EventEmitter = require('events').EventEmitter;

var debug = require('debug')('samsaara:index'),
    util = require('util');

var middleware = require('./lib/middleware');

var connectionController,
    communicationController,
    router,
    constructors,
    Connection = require('./models/connection'),
    NameSpace = require('./models/namespace'),
    IncomingCallBack = require('./models/callback');

util.inherits(Samsaara, EventEmitter);


function Samsaara() {

    EventEmitter.call(this);

    this.uuid = makeAlphaNumericalId(8);
    this.transport = null;    

    connectionController = require('./lib/connectionController')(this.uuid);
    communicationController = new require('./lib/communicationController')(this.uuid);
    router = new require('./lib/router')(this.uuid, communicationController);

    Connection.initialize(this);
    NameSpace.initialize(this);
    IncomingCallBack.initialize(this);

    this.capability = {};
    this.modules = [];   

    this.connection = connectionController.connection;
    this.nameSpace = communicationController.nameSpace;
    this.createNamespace = communicationController.createNamespace;
    this.expose = communicationController.expose;
}

Samsaara.prototype.use = function(module) {
    this.modules.push(module);
    return this;
};

Samsaara.prototype.initialize = function(opts) {

    opts = opts || {};

    middleware.load(this);
    this.transport = opts.socket;

    return this;
};


function makeAlphaNumericalId(idLength) {

    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < idLength; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}


exports = module.exports = new Samsaara();
