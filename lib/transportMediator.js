var MediatedSocket,
    messageHandler,
    closeHandler;

var MediatedW3C = require('./mediators/websocketW3C'),
    MediatedWebsocket = require('./mediators/websocket'),
    MediatedSockJS = require('./mediators/sockjs'),
    MediatedEngineIO = require('./mediators/engineio'),
    MediatedSocketIO = require('./mediators/socketio'),
    MediatedPrimus = require('./mediators/primus');


function initialize(socketType, isClient, messageHndlr, closeHndlr) {

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
}


function mediateSocket(socket, samsaaraConnection) {
    return new MediatedSocket(socket, samsaaraConnection, messageHandler, closeHandler);
}


module.exports = {
    initialize: initialize,
    mediateSocket: mediateSocket
};
