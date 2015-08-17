var uuid = require('uuid');
var heartbeats = require('heartbeats');

var executionController = require('../controllers/executionController');
var ConnectionInitializer = require('./connectionInitializer');
var transportMediator = require('../mediator/transportMediator');
var addReadOnlyBaseProperty = require('../utils/helper').addReadOnlyBaseProperty;
var addWritableBaseProperty = require('../utils/helper').addWritableBaseProperty;


function Connection(socket, owner, opts) {
    opts = opts || {};

    addReadOnlyBaseProperty(this, 'socket', transportMediator.mediateSocket(socket, this));
    addReadOnlyBaseProperty(this, 'id', uuid.v4());
    addReadOnlyBaseProperty(this, 'name', opts.name);
    addReadOnlyBaseProperty(this, 'owner', owner);
    addReadOnlyBaseProperty(this, 'incomingPulse', heartbeats.heart('samsaara').newPulse());
    addReadOnlyBaseProperty(this, 'outgoingPulse', heartbeats.heart('samsaara').newPulse());
    addReadOnlyBaseProperty(this, 'initializer', new ConnectionInitializer(this));

    addWritableBaseProperty(this, 'routeID', this.id.slice(0, 8));

    this.state = {};
}

Object.defineProperty(Connection.prototype, 'initialized', {
    get: function() {
        return this.initializer.initialized;
    }
});

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
        execute: function(funcName) {
            return function() {
                executionController.execute(connection.socket, connection.routeID, [connection.id], namespaceName, funcName, arguments);
            };
        }
    };
};

// Method to execute methods on the client.
Connection.prototype.execute = function(funcName, namespaceName) {
    var connection = this;
    namespaceName = namespaceName || 'core';

    return function() {
        executionController.execute(connection.socket, connection.routeID, [connection.id], namespaceName, funcName, arguments);
    };
};

// Method to execute on the client with a raw (pre processed) packet.
Connection.prototype.executeRaw = function(packet, cb) {
    executionController.executeRaw(this.socket, this.routeID, [this.id], packet, cb);
};

// Method to close the connection socket.
Connection.prototype.close = function(code, message) {
    this.socket.close(code, message);
};


module.exports = Connection;
