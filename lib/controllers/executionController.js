var IncomingCallBack = require('../constructors/callback');
var NameSpace = require('../constructors/namespace');
var routeController = require('./routeController');

var core;

var incomingCallbacks = {};
var outgoingCallbacks = {};
var nameSpaces = {};


var executionController = {

    initialize: function(samsaaraCore) {
        core = samsaaraCore;

        nameSpaces.core = new NameSpace('core', {});
        nameSpaces.internal = new NameSpace('internal', {
            callItBack: callItBack,
            callItBackError: callItBackError
        });
    },


    // Outgoing Execution

    execute: function(channel, route, executorArray, namespaceName, funcName, args) {

        var packet = {
            func: funcName,
            ns: namespaceName || 'core',
            args: Array.prototype.slice.call(args)
        };

        if (typeof args[args.length - 1] === 'function') {
            createCallBack(packet.args.pop(), executorArray, packet);
        }

        routeController.routeOutgoingPacket(channel, route, packet);
    },

    executeRaw: function(channel, route, executorArray, packet, callBack) {

        if (typeof callBack === 'function') {
            createCallBack(callBack, executorArray, packet);
        }

        routeController.routeOutgoingPacket(channel, route, packet);
    },


    // Incoming Execution

    executeFunction: function(executor, context, incomingPacket, callBackGenerator) {

        var functionName = incomingPacket.func;
        var namespaceName = incomingPacket.ns || 'core';
        var namespace = this.nameSpace(namespaceName);
        var namespaceMethods;
        var messageArgs;
        var theCallBack;
        var callbackID;

        if (namespace !== undefined) {

            namespaceMethods = namespace.methods;

            if (typeof namespaceMethods[functionName] === 'function') {

                messageArgs = incomingPacket.args || [];

                callBackGenerator = callBackGenerator || generateOutgoingCallBackClosure;
                callbackID = incomingPacket.callBack;

                if (typeof callbackID === 'string' && callbackID.match(/^([a-zA-Z0-9\.]+)$/)) {
                    theCallBack = outgoingCallbacks[callbackID] = callBackGenerator(callbackID, executor);
                    messageArgs.push(theCallBack);
                }

                namespaceMethods[functionName].apply(context, messageArgs);

            } else {
                console.error('Samsaara Method Execution ERROR: Call by:', executor.id, ':', functionName, 'is not an exposed Samsaara Object that can be executed.');
            }

        } else {
            console.error('Samsaara Method Execution ERROR: Call by:', executor.id, ':', namespaceName, 'is not valid namespace.');
        }
    },


    // Exported to Core

    createNamespace: function(namespaceName, methods) {

        var nameSpace = null;

        if (namespaceName !== 'core' && namespaceName !== 'internal') {
            nameSpace = new NameSpace(namespaceName, methods);
            nameSpaces[namespaceName] = nameSpace;
        }

        return core;
    },

    nameSpace: function(namespaceName) {
        return nameSpaces[namespaceName];
    },

    expose: function(set) {
        this.nameSpace('core').expose(set);
        return core;
    }
};


// a method to process a packet for multiple executors
// args is initially an arguments object
function processPacket(executorArray, packet, args) {

    if (typeof args[args.length - 1] === 'function') {
        args = Array.prototype.slice.call(args);
        createCallBack(args.pop(), executorArray, packet);
    }

    packet.args = args;

    return packet;
}


// Incoming CallBack Generator
// Creates an expected Callback method, whose index is sent to clients.
// The callback will expect a certain number of processes/clients to execute before getting deleted/set to undefined.
function createCallBack(theCallBack, executorArray, packet) {

    var incomingCallback = new IncomingCallBack(theCallBack, executorArray, destroyCallBack);
    var callbackID = incomingCallback.callbackID;

    incomingCallbacks[callbackID] = incomingCallback;
    packet.callBack = callbackID;

    return incomingCallback;
}

function destroyCallBack(callbackID) {
    incomingCallbacks[callbackID] = undefined;
}


// Outgoing CallBack Generator
// Returns a function to send a message answering a callBack request sent from the client
function generateOutgoingCallBackClosure(callbackID, executor) {

    var theCallBack = function() {
        var args = Array.prototype.slice.call(arguments),
            packet = {
                ns: 'internal',
                func: 'callItBack',
                args: [callbackID, args]
            },
            aCallBack;

        if (typeof args[args.length - 1] !== 'function') {
            executor.executeRaw(packet);
        } else {
            aCallBack = args.pop();
            executor.executeRaw(packet, aCallBack);
        }

        outgoingCallbacks[callbackID] = undefined;
    };

    return theCallBack;
}


// Exposed CallBack Execution Method
// Allows the client to execute an indexed method that was stored for callback
function callItBack(callbackID, args) {

    var executor = this;
    var executorID = executor.id;
    var theCallBack = incomingCallbacks[callbackID];

    if (theCallBack !== undefined && args instanceof Array) {

        if (typeof arguments[arguments.length - 1] === 'function') {
            args.push(arguments[arguments.length - 1]);
        }

        theCallBack.executeCallBack(executorID, executor, args);
    }
}

// Exposed CallBack Execution Error Method
// Allows the client to execute an indexed method that was stored for callback
function callItBackError(callbackID, args) {

    var executor = this;
    var executorID = executor.id;
    var theCallBack = incomingCallbacks[callbackID];

    if (theCallBack !== undefined) {
        theCallBack.callBackError(executorID, executor, args);
    }
}


module.exports = executionController;
