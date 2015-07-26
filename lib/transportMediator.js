var transportMediator = {},    
    connectionController,
    sockjsSocketDef = {

        onconnection: function() {
            transport.on('connection', function(conn) {
                connectionController.createConnection(conn);
            });
        },

        mediate: function(socket, samsaara_connection) {

        		socket.send = socket.write;

            socket.on('close', function(message) {
                samsaara_connection.closeConnection(message);
                socket.removeAllListeners();
            });

            socket.on('data', function(message) {
                samsaara_connection.handleMessage(message);
            });
        }
    },

    webSocketDef = {

        mediate: function(socket, samsaara_connection) {

            socket.on('close', function(message) {
                samsaara_connection.closeConnection(message);                
            });

            socket.on('message', function(message) {
                samsaara_connection.handleMessage(message);
            });
        }
    };


function initialize(transport, connection_controller) {

    connectionController = connection_controller;

    if (transport === undefined) {
        transport = require('sockjs');
    }

    if (typeof transport.onclose === 'function' && typeof transport.ondata === 'function') {
        transportMediator.onclose = sockjsdef.onclose;
        transportMediator.ondata = sockjsdef.ondata;
    } else if (transport) {

    }
}

function mediateTransport(socket, samsaara_connection){
	transportMediator.mediate(socket, this);  
}


module.exports = {
    initialize: initialize,
    mediate: mediate
};
 