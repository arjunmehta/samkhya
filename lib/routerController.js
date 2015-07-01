var debug = require('debug')('samsaara:router');
var debugError = require('debug')('samsaara:router:error');

var samsaara_id,
    communicationController;

var preRouteFilters = [],
    messageRoutes = {

        OWN: function(connection, headerbits, incoming_packet) {

            var parsed_packet = parseJSON(incoming_packet);

            if (parsed_packet !== undefined && parsed_packet.func !== undefined) {
                parsed_packet.sender = connection.id;
                communicationController.executeFunction(connection, connection, parsed_packet);
            }
        },

        INIT: function(connection, headerbits, incoming_packet) {
          
            var parsed_packet = parseJSON(incoming_packet);

            if (parsed_packet !== undefined && parsed_packet.opts !== undefined) {
                debug("Connection Options", parsed_packet.opts);
                connection.initialize(parsed_packet.opts);
            }
        }
    };


function initialize(uuid, communication_controller) {

    samsaara_id = uuid;
    communicationController = communication_controller;

    return new Router();
}

function Router() {}

Router.prototype.newConnectionMessage = function(connection, message) {

    debug("New Connection Message", connection.id, message);

    var self = this;
    var i = 0;
    var splitIndex = message.indexOf("::");
    var headerbits = message.substr(0, splitIndex).split(":");

    message = message.slice(2 + splitIndex - message.length);

    next();

    function next(err) {
        if (err !== undefined) {
            debugError("Message Acceptance Error:", err);
        } else if (preRouteFilters.length > i) {
            preRouteFilters[i++](connection, headerbits, message, next);
        } else {
            self.route(connection, headerbits, message);
        }
    }
};


// compare the first value in the header to what might exist in the messageRoutes object.

Router.prototype.route = function(connection, headerbits, message) {
    if (messageRoutes[headerbits[0]]) {
        messageRoutes[headerbits[0]](connection, headerbits, message);
    }
};


function parseJSON(raw_packet) {
    var parsed_packet;

    try {
        parsed_packet = JSON.parse(raw_packet);
    } catch (err) {
        debug("Message Error: Invalid JSON", raw_packet, err);
    }

    return parsed_packet;
}


module.exports = {
    initialize: initialize
};
