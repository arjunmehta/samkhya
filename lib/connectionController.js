var debug = require('debug')('samsaara:connections');
var heartbeats = require('heartbeats');

var samsaara_id;
var Connection = require('./constructors/connection').Constructor;


function ConnectionController(uuid) {

    samsaara_id = uuid;

    this.connections = {};
    this.heartBeatThreshold = 11000;
    this.heart = heartbeats.createHeart(heartBeatThreshold, 'global');
    this.clearConnectionsInterval = setInterval(this.checkForDeadConnections, this.heartBeatThreshold * 2.5);
}

ConnectionController.prototype.connection = function(connection_id) {
    return this.connections[connection_id];
};

ConnectionController.prototype.newConnection = function(raw_connection) {
    var new_samsaara_connection = new Connection(raw_connection);
    this.connections[new_samsaara_connection.id] = new_samsaara_connection;
};

ConnectionController.prototype.checkForDeadConnections = function() {

    var threshold = Math.floor(25000 / 10000),
        connection,
        connections = this.connections;

    for (var connID in connections) {

        connection = connections[connID];

        if (connection.owner === samsaara_id && connection.pulse.missedBeats() > threshold) {
            connection.conn.close(111, "Flatlining Connection");
        }
    }
};


exports = module.exports = function(uuid) {
    return new ConnectionController(uuid);
};
