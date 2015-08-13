var uuid = require('uuid');
var heart = require('heartbeats').heart('samsaara');

var ConnectionInitializer = require('./connectionInitializer');
var transportMediator = require('./transportMediator');
var addBaseProperty = require('./utils/helper').addBaseProperty;

var communicationController;

function initialize(communicationCtrl) {
    communicationController = communicationCtrl;
    return Connection;
}

function Connection(socket, owner, opts) {
    opts = opts || {};

    addBaseProperty(this, 'socket', new transportMediator.MediatedSocket(socket));
    addBaseProperty(this, 'id', uuid.v4());
    addBaseProperty(this, 'name', opts.name);
    addBaseProperty(this, 'routeID', this.id.slice(0, 8));
    addBaseProperty(this, 'owner', owner);
    addBaseProperty(this, 'incomingPulse', heart.newPulse());
    addBaseProperty(this, 'outgoingPulse', heart.newPulse());
    addBaseProperty(this, 'initializer', new ConnectionInitializer(this));

    this.state = {};
    this.initialized = this.initializer.initialized;
}

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


module.exports = {
    initialize: initialize,
    Constructor: Connection
};
