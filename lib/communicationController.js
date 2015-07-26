// samsaara - communication controller
// Controls packet interpretation and execution, including callback handling.


var IncomingCallBack = require('./constructors/callback').Constructor,
    NameSpace = require('./constructors/namespace').Constructor;

var samsaaraId,
    core,
    connection,
    routeController;


function CommunicationController(pseudoUuid, samsaaraCore, connectionController) {

    samsaaraId = pseudoUuid;
    core = samsaaraCore;
    connection = connectionController.connection;

    this.outgoingCallBacks = {};
    this.incomingCallbacks = {};
    this.nameSpaces = {};

    this.createNamespace('core', {});
    this.createNamespace('internal', {
        callItBack: this.callItBack,
        callItBackError: this.callItBackError
    });
}


// OUTGOING

CommunicationController.prototype.executeRaw = function(channel, route, executorArray, packet, callBack) {

    if (typeof callBack === 'function') {
        this.makeCallBack(callBack, executorArray, packet);
    }

    routeController.routePacket(channel, route, packet);
};


// args is initially an arguments object

CommunicationController.prototype.execute = function(channel, route, executorArray, namespaceName, funcName, args) {

    var packet = {
        func: funcName,
        ns: namespaceName || 'core',
        args: args
    };

    if (typeof args[args.length - 1] === 'function') {
        packet.args = Array.slice(args);
        this.makeCallBack(packet.args.pop(), executorArray, packet);
    }

    routeController.routePacket(channel, route, packet);
};


// a method to process a packet for multiple executors
// args is initially an arguments object

CommunicationController.prototype.processPacket = function(executorArray, packet, args) {

    if (typeof args[args.length - 1] === 'function') {
        args = Array.slice(args);
        this.makeCallBack(args.pop(), executorArray, packet);
    }

    packet.args = args;

    return packet;
};


// Incoming CallBack Generator
// Creates an expected Callback method, whose index is sent to clients.
// The callback will expect a certain number of processes/clients to execute before getting deleted/set to undefined.

CommunicationController.prototype.makeCallBack = function(theCallBack, executorArray, packet) {

    var incomingCallback = new IncomingCallBack(theCallBack, executorArray);
    var callbackId = incomingCallback.id;

    this.incomingCallbacks[callbackId] = incomingCallback;
    packet.callBack = callbackId;

    return incomingCallback;
};

// Exposed CallBack Execution Method
// Allows the client to execute an indexed method that was stored for callback

CommunicationController.prototype.callItBack = function(executorId, callbackId, args) {

    var executor = connection(executorId);
    var theCallBack = this.incomingCallbacks[callbackId];

    if (theCallBack !== undefined && args instanceof Array) {

        if (typeof arguments[arguments.length - 1] === 'function') {
            args.push(arguments[arguments.length - 1]);
        }

        theCallBack.executeCallBack(executorId, executor, args);
    }
};


// Exposed CallBack Execution Error Method
// Allows the client to execute an indexed method that was stored for callback

CommunicationController.prototype.callItBackError = function(executorId, callbackId, args) {

    var executor = connection(executorId);
    var theCallBack = this.incomingCallbacks[callbackId];

    if (theCallBack !== undefined) {
        theCallBack.callBackError(executorId, executor, args);
    }
};


CommunicationController.prototype.createNamespace = function(namespaceName, methods) {
    var nameSpace = null;

    if (namespaceName !== 'core' && namespaceName !== 'internal') {
        nameSpace = this.nameSpaces[namespaceName] = new NameSpace(namespaceName, methods);
    }

    return nameSpace;
};

CommunicationController.prototype.nameSpace = function(namespaceName) {
    return this.nameSpaces[namespaceName];
};


// INCOMING

CommunicationController.prototype.expose = function(set) {
    this.nameSpace('core').expose(set);
    return core;
};


CommunicationController.prototype.executeFunction = function(executor, context, incomingPacket, callBackGenerator) {

    var functionName = incomingPacket.func,
        namespaceName = incomingPacket.ns || 'core',
        namespace = this.nameSpace(namespaceName),
        namespaceMethods,
        messageArgs,
        theCallBack,
        callbackId;

    if (namespace !== undefined) {

        namespaceMethods = namespace.methods;

        if (typeof namespaceMethods[functionName] === 'function') {

            messageArgs = incomingPacket.args || [];

            callBackGenerator = callBackGenerator || this.createOutgoingCallBack;
            callbackId = incomingPacket.callBack;

            if (typeof callbackId === 'string' && callbackId.match(/^([a-zA-Z0-9\.]+)$/)) {
                theCallBack = this.outgoingCallBacks[callbackId] = callBackGenerator(callbackId, incomingPacket.sender, incomingPacket.owner);
                messageArgs.push(theCallBack);
            }

            namespaceMethods[functionName].apply(context, messageArgs);

        } else {
            console.error('Samsaara Method Execution ERROR: Call by:', incomingPacket.sender, ':', functionName, 'is not an exposed Samsaara Object that can be executed.');
        }

    } else {
        console.error('Samsaara Method Execution ERROR: Call by:', incomingPacket.sender, ':', namespaceName, 'is not valid namespace.');
    }
};


// Outgoing CallBack Generator
// Returns a function to send a message answering a callBack request sent from the client

CommunicationController.prototype.createOutgoingCallBack = function(callbackId, senderId, ownerId) {

    var self = this;

    var theCallBack = function() {

        var args = Array.slice(arguments),
            packet = {
                ns: 'internal',
                func: 'callItBack',
                args: [ownerId, callbackId, args]
            },
            aCallBack;

        if (typeof args[args.length - 1] !== 'function') {
            self.executeRaw(connection(senderId), packet);
        } else {
            aCallBack = args.pop();
            self.executeRaw(connection(senderId), packet, aCallBack);
        }

        delete self.outgoingCallBacks[callbackId];
    };

    return theCallBack;
};


module.exports = function(pseudoUuid, samsaaraCore, connectionController) {
    return new CommunicationController(pseudoUuid, samsaaraCore, connectionController);
};
