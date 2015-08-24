var EventEmitter = require('events').EventEmitter;
var util = require('util');
var heartbeats = require('heartbeats');

var routeController = require('./lib/controllers/routeController');
var connectionController = require('./lib/controllers/connectionController');
var executionController = require('./lib/controllers/executionController');

var helper = require('./lib/utils/helper');
var parser = require('./lib/utils/parser');
var middleware = require('./lib/utils/middleware');

var heart;

util.inherits(Samsaara, EventEmitter);


function Samsaara() {

    EventEmitter.call(this);

    routeController.setParser(parser);
    connectionController.initialize(this, null);
    executionController.initialize(this);
    middleware.initialize(this);

    this.nameSpace = executionController.nameSpace.bind(executionController);
    this.createNamespace = executionController.createNamespace.bind(executionController);
    this.expose = executionController.expose.bind(executionController);
    this.use = middleware.use.bind(middleware);
}

Samsaara.prototype.initialize = function(opts) {
    opts = opts || {};

    heart = heartbeats.createHeart(2000, 'samsaara');
    connectionController.setTransport(opts.socketType || 'ws', true);

    this.core = connectionController.newConnection(opts.socket);

    // this.execute = this.core.execute.bind(this.core);
    // this.executeRaw = this.core.executeRaw.bind(this.core);
    // this.nameSpace = this.core.nameSpace.bind(this.core);
    // this.close = this.core.close.bind(this.core);
    // this.setState = this.core.setState.bind(this.core);

    middleware.loader();

    initializeClient(this, this.core, opts);

    return this;
};

Object.defineProperty(Samsaara.prototype, 'state', {
    get: function() {
        return this.core ? this.core.state : null;
    }
});


// Initialize client instance

function initializeClient(samsaara, core, opts) {
    routeController.addRoute('INIT', initializationRouteHandler);
    exposeStateHandler(samsaara);
}


// Route Handlers

function initializationRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket),
        connectionOwner,
        connectionRouteID,
        heartbeatInterval;

    if (typeof parsedPacket === 'object') {
        connectionOwner = parsedPacket.connectionOwner;
        connectionRouteID = parsedPacket.connectionRouteID;
        heartbeatInterval = parsedPacket.heartbeatInterval;

        helper.addReadOnlyBaseProperty(connection, 'routeID', connectionOwner);
        routeController.addRoute(connectionRouteID, executionRouteHandler);
        connection.queue.emptyToRoute(connectionOwner);
        setHeartbeats(connection, heartbeatInterval);
    }
}

function executionRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket);

    if (parsedPacket !== undefined && parsedPacket.func !== undefined) {
        parsedPacket.sender = connection.id;
        executionController.executeFunction(connection, connection, parsedPacket);
    }
}


// State Change Handler

function exposeStateHandler(samsaara) {

    samsaara.nameSpace('internal').expose({
        setState: function(state, cb) {
            var connection = this;
            var attributeName;
            for (attributeName in state) {
                connection.state[attributeName] = state[attributeName];
            }
            samsaara.emit('stateChange', connection.state, connection);
            cb(true);
        }
    });
}


// Heartbeats

function setHeartbeats(connection, heartbeatInterval) {
    heart.setHeartrate(heartbeatInterval);
    heart.createEvent(1, function() {
        if (connection.outgoingPulse.missedBeats() > 0) {
            connection.socket.send('H');
        }
    });
}


module.exports = new Samsaara();
