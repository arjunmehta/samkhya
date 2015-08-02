/*!
 * samsaaraSocks - Connection Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var uuid = require('uuid');
var heart = require('heartbeats').heart('global');
var transportMediator = require('./transportMediator');

var samsaaraID,
    core,
    communicationController,
    routeController,
    connectionController;

var preInitializationMethods = [],
    initializationMethods = {},
    closingMethods = [];


function initialize(pseudoUuid, samsaaraCore, communicationCtrl, connectionCtrl, routeCtrl) {
    samsaaraID = pseudoUuid;
    core = samsaaraCore;
    communicationController = communicationCtrl;
    connectionController = connectionCtrl;
    routeController = routeCtrl;

    return Connection;
}


function Connection(socket, opts) {
    var i;

    opts = opts || {};

    addBaseProperty(this, 'socket', new transportMediator.MediatedSocket(socket));
    addBaseProperty(this, 'id', uuid.v4());
    addBaseProperty(this, 'name', opts.name);
    addBaseProperty(this, 'routeID', this.id.slice(0, 8));
    addBaseProperty(this, 'owner', samsaaraID);
    addBaseProperty(this, 'incomingPulse', heart.newPulse());
    addBaseProperty(this, 'outgoingPulse', heart.newPulse());

    this.state = {};

    for (i = 0; i < preInitializationMethods.length; i++) {
        preInitializationMethods[i](this);
    }

    core.emit('connected', this);
}


//
// Public Methods
//

// Method to update connectionData attribute on the connection. This method should be used when updating
// the connection with new data, as it can be middlewared to broadcast changes, etc.
Connection.prototype.setState = function(attributeName, value, cb) {
    this.state[attributeName] = value;
    this.execute('setState')(attributeName, value, cb);
};

// returns a namespace object that returns an execute method with the namespace as a closure..
Connection.prototype.nameSpace = function(namespaceName) {
    var connection = this;

    return {
        execute: function execute(funcName) {
            return function() {
                communicationController.execute(connection.socket, connection.routeID, [connection.id], namespaceName, funcName, arguments);
            };
        }
    };
};

// Method to execute methods on the client.
Connection.prototype.execute = function(funcName, namespaceName) {
    var connection = this;
    namespaceName = namespaceName || 'core';

    return function() {
        communicationController.execute(connection.socket, connection.routeID, [connection.id], namespaceName, funcName, arguments);
    };
};

// Method to execute on the client with a raw (pre processed) packet.
Connection.prototype.executeRaw = function(packet, cb) {
    communicationController.executeRaw(this.socket, this.routeID, [this.id], packet, cb);
};


function addBaseProperty(obj, name, value) {
    Object.defineProperty(obj, name, {
        enumerable: false,
        configurable: false,
        writable: false,
        value: value
    });
}


module.exports = {
    initialize: initialize,

    preInitializationMethods: preInitializationMethods,
    initializationMethods: initializationMethods,
    closingMethods: closingMethods,

    Constructor: Connection
};
