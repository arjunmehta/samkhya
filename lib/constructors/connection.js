var EventEmitter = require('events').EventEmitter;
var util = require('util');

var uuid = require('uuid');
var heartbeats = require('heartbeats');

var executionController = require('../controllers/executionController');
var ConnectionInitializer = require('./connectionInitializer');
var ConnectionQueue = require('./connectionQueue');
var transportMediator = require('../mediator/transportMediator');

var addReadOnlyBaseProperty = require('../utils/helper').addReadOnlyBaseProperty;

util.inherits(Connection, EventEmitter);


function Connection(socket, owner, opts) {
    opts = opts || {};

    addReadOnlyBaseProperty(this, 'socket', transportMediator.mediateSocket(socket, this));
    addReadOnlyBaseProperty(this, 'id', uuid.v4());
    addReadOnlyBaseProperty(this, 'name', opts.name);
    addReadOnlyBaseProperty(this, 'owner', owner);
    addReadOnlyBaseProperty(this, 'incomingPulse', heartbeats.heart('samsaara').newPulse());
    addReadOnlyBaseProperty(this, 'outgoingPulse', heartbeats.heart('samsaara').newPulse());
    addReadOnlyBaseProperty(this, 'initializer', new ConnectionInitializer(this));
    addReadOnlyBaseProperty(this, 'queue', new ConnectionQueue(this));

    if (owner) {
        addReadOnlyBaseProperty(this, 'routeID', this.id.slice(0, 8));
    }
}

Object.defineProperty(Connection.prototype, 'initialized', {
    get: function() {
        return this.initializer.initialized;
    }
});

// returns a namespace object that returns an execute method with the namespace as a closure..
Connection.prototype.nameSpace = function(namespaceName) {

    var connection = this;

    return {
        execute: function(funcName) {
            return function() {
                evalExecute(connection, connection.socket, [connection.id], namespaceName, funcName, arguments);
            };
        }
    };
};

// Method to execute methods on the client.
Connection.prototype.execute = function(funcName, namespaceName) {
    var connection = this;
    namespaceName = namespaceName || 'core';

    return function() {
        evalExecute(connection, connection.socket, [connection.id], namespaceName, funcName, arguments);
    };
};

// Method to execute on the client with a raw (pre processed) packet.
Connection.prototype.executeRaw = function(packet, cb) {
    evalExecuteRaw(this, this.socket, this.routeID, [this.id], packet, cb);
};

// Method to close the connection socket.
Connection.prototype.close = function(code, message) {
    this.socket.close(code, message);
};


function evalExecute(connection, channel, executorArray, namespaceName, funcName, args) {
    if (connection.routeID) {
        executionController.execute(channel, connection.routeID, executorArray, namespaceName, funcName, args);
    } else {
        connection.queue.add(channel, executorArray, namespaceName, funcName, args);
    }
}

function evalExecuteRaw(connection, channel, executorArray, packet, cb) {
    if (connection.routeID) {
        executionController.executeRaw(channel, connection.routeID, executorArray, packet, cb);
    } else {
        connection.queue.addRaw(channel, executorArray, packet, cb);
    }
}


module.exports = Connection;
