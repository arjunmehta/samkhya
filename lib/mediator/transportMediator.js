var MediatedW3C = require('./transports/websocketW3C');
var MediatedWebsocket = require('./transports/websocket');
var MediatedSockJS = require('./transports/sockjs');
var MediatedEngineIO = require('./transports/engineio');
var MediatedSocketIO = require('./transports/socketio');
var MediatedPrimus = require('./transports/primus');

var MediatedSocket;
var messageHandler;
var closeHandler;


var transportMediator = {

    initialize: function(socketType, isClient, messageHndlr, closeHndlr) {

        messageHandler = messageHndlr;
        closeHandler = closeHndlr;

        switch (socketType) {
            case 'ws_w3c':
                MediatedSocket = isClient ? MediatedW3C.Client : MediatedW3C.Server;
                break;
            case 'sockjs':
                MediatedSocket = isClient ? MediatedSockJS.Client : MediatedSockJS.Server;
                break;
            case 'socketio':
                MediatedSocket = isClient ? MediatedSocketIO.Client : MediatedSocketIO.Server;
                break;
            case 'primus':
                MediatedSocket = isClient ? MediatedPrimus.Client : MediatedPrimus.Server;
                break;
            case 'ws':
                MediatedSocket = isClient ? MediatedWebsocket.Client : MediatedWebsocket.Server;
                break;
            case 'engineio':
                MediatedSocket = isClient ? MediatedEngineIO.Client : MediatedEngineIO.Server;
                break;
            default:
                break;
        }
    },

    mediateSocket: function(socket, samsaaraConnection) {
        return new MediatedSocket(socket, samsaaraConnection, messageHandler, closeHandler);
    }
};


module.exports = transportMediator;
