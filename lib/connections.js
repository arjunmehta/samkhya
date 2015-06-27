var debug = require('debug')('samsaara:connections');
var heartbeats = require('heartbeats');

var Connection,
    uuid;


function ConnectionController(samsaara) {

    uuid = samsaara.uuid;

    this.connections = {};
    this.heartBeatThreshold = 11000;

    this.heart = heartbeats.createHeart(heartBeatThreshold, 'global');
    this.clearConnectionsInterval = setInterval(this.checkForDeadConnections, this.heartBeatThreshold * 2.5);

    Connection = samsaara.constructors.Connection;
}

ConnectionController.prototype.connection = function(connection_id) {
    return this.connections[connection_id];
};

ConnectionController.prototype.createNewConnection = function(raw_connection) {
    var new_samsaara_connection = new Connection(raw_connection);
    this.connections[new_samsaara_connection.id] = new_samsaara_connection;
};

ConnectionController.prototype.checkForDeadConnections = function() {

    var threshold = Math.floor(25000 / 10000),
        connection,
        connections = this.connections;

    for (var connID in connections) {

        connection = connections[connID];

        if (connection.owner === uuid && connection.pulse.missedBeats() > threshold) {
            connection.conn.close(111, "Flatlining Connection");
        }
    }
};


exports = module.exports = {
    initialize: initialize
};
