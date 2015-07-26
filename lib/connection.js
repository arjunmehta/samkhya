/*!
 * samsaaraSocks - Connection Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var uuid = require('uuid');
var heart = require('heartbeats').heart('global');
var transportMediator = require('./transportMediator');

var samsaaraId,
    core,
    communicationController,
    routeController,
    connectionController;

var preInitializationMethods = [],
    initializationMethods = {},
    closingMethods = [];


function initialize(pseudoUuid, samsaaraCore, communicationCtrl, connectionCtrl, routeCtrl) {

    samsaaraId = pseudoUuid;
    core = samsaaraCore;
    communicationController = communicationCtrl;
    connectionController = connectionCtrl;
    routeController = routeCtrl;

    return Connection;
}


function Connection(socket, opts) {

    var i;

    opts = opts || {};

    this.socket = socket;

    this.id = uuid.v4();
    this.name = opts.name;
    this.owner = samsaaraId;

    // this.initialization = new InitializedAttributes(this);
    this.pulse = heart.newPulse();
    this.state = {};

    transportMediator.mediate(socket, this, messageHandler, closeHandler);

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
    this.execute('setState')(attributeName, value);
    cb(this.state);
};

// returns a namespace object that returns an execute method with the namespace as a closure..
Connection.prototype.nameSpace = function(namespaceName) {

    var channel = this.socket;
    var connection = this;

    return {
        execute: function execute(funcName) {
            return function() {
                communicationController.execute(channel, [connection.id], namespaceName, funcName, arguments);
            };
        }
    };
};

// Method to execute methods on the client.
Connection.prototype.execute = function(funcName, namespaceName) {

    var channel = this.socket;
    var connection = this;
    namespaceName = namespaceName || 'core';

    return function() {
        communicationController.execute(channel, [connection.id], namespaceName, funcName, arguments);
    };
};

// Method to execute on the client with a raw (pre processed) packet.
Connection.prototype.executeRaw = function(packet, cb) {
    communicationController.executeRaw(this.socket, [this.id], packet, cb);
};


//
// Private Methods
//

// Method to handle new socket messages.

function messageHandler(connection, rawMessage) {

    connection.pulse.beat();

    switch (rawMessage) {
        case 'H':
            break;
        default:
            routeController.newIncomingMessage(connection, rawMessage);
    }
}

// Connection close handler.
// Executed when the socket closes

function closeHandler(connection, message) {
    var i;

    core.emit('disconnected', connection);

    for (i = 0; i < closingMethods.length; i++) {
        closingMethods[i](connection);
    }

    connectionController.removeConnection(connection.id);
}


module.exports = {

    initialize: initialize,

    preInitializationMethods: preInitializationMethods,
    initializationMethods: initializationMethods,
    closingMethods: closingMethods,

    Constructor: Connection
    // InitializedAttributes: InitializedAttributes
};
