var logError = require('debug')('samsaara:communication:error');

var IncomingCallBack,
    NameSpace;

var uuid;


function CommunicationController(samsaara) {

    uuid = samsaara.uuid;
    this.core = samsaara;

    this.outgoingCallBacks = {};
    this.incoming_callbacks = {};
    this.nameSpaces = {};

    this.createNamespace('core', {});
    this.createNamespace('internal', {
        callItBack: this.callItBack,
        callItBackError: this.callItBackError
    });

    IncomingCallBack = samsaara.constructors.IncomingCallBack;
    NameSpace = samsaara.constructors.NameSpace;
}


CommunicationController.prototype.expose = function(set) {
    this.nameSpace('core').expose(set);
    return this.core;
};

CommunicationController.prototype.executeFunction = function(executor, context, incoming_packet, callBackGenerator) {

    var function_name = incoming_packet.func,
        namespace_name = incoming_packet.ns || 'core',
        namespace = this.nameSpace(namespace_name),
        namespace_methods,
        message_args,
        callback_id;

    if (namespace !== undefined) {

        namespace_methods = namespace.methods;

        if (typeof namespace_methods[function_name] === 'function') {

            message_args = incoming_packet.args || [];

            if (message_args[0] === 'samsaara.self') {
                message_args[0] = executor;
            }

            callBackGenerator = callBackGenerator || this.createOutgoingCallBack;
            callback_id = incoming_packet.callBack;

            if (typeof callback_id === 'string' && callback_id.match(/^([a-zA-Z0-9\.]+)$/)) {
                var theCallBack = this.outgoingCallBacks[callback_id] = callBackGenerator(callback_id, incoming_packet.sender, incoming_packet.owner);
                message_args.push(theCallBack);
            }

            namespace_methods[function_name].apply(context, message_args);

        } else {
            console.error('Samsaara Method Execution ERROR: Call by:', incoming_packet.sender, ':', function_name, 'is not an exposed Samsaara Object that can be executed via the client.');
        }

    } else {
        console.error('Samsaara Method Execution ERROR: Call by:', incoming_packet.sender, ':', namespace_name, 'is not valid nameSpace.');
    }
};

CommunicationController.prototype.processPacketSync = function(executor_array, packet, args) {

    var processed_packet = {};

    if (typeof args[args.length - 1] === 'function') {
        processed_packet.incomingCallBack = this.makeCallBackSync(args.pop(), executor_array, packet);
    }

    packet.args = args;
    processed_packet.packet_string = JSON.stringify([uuid, packet]);

    return processed_packet;
};


// Incoming CallBack Generator
// Creates an expected Callback method, whose index is sent to clients.
// The callback will expect a certain number of processes/clients to execute before getting deleted/set to undefined.

CommunicationController.prototype.makeCallBackSync = function(theCallBack, executor_array, packet) {

    var incoming_callback = new IncomingCallBack(theCallBack, executor_array);
    var callback_id = incoming_callback.id;

    this.incoming_callbacks[callback_id] = incoming_callback;

    packet.callBack = callback_id;

    return incoming_callback;
};


// Outgoing CallBack Generator
// Returns a function to send a message answering a callBack request sent from the client

CommunicationController.prototype.createOutgoingCallBack = function(id, sender, owner) {

    var self = this;

    var theCallBack = function() {

        var args = Array.prototype.slice.call(arguments);

        if (typeof args[args.length - 1] !== 'function') {

            self.core.connection(sender).executeRaw({
                ns: 'internal',
                func: 'callItBack',
                args: [id, owner, args]
            });

        } else {

            var aCallBack = args.pop();

            self.core.connection(sender).executeRaw({
                ns: 'internal',
                func: 'callItBack',
                args: [id, owner, args]
            }, aCallBack);
        }

        delete self.outgoingCallBacks[id];
    };

    return theCallBack;
};


// Exposed CallBack Execution Method
// Allows the client to execute an indexed method that was stored for callback

CommunicationController.prototype.callItBack = function(executor, callBackID, args) {

    var theCallBack = this.incoming_callbacks[callBackID];

    if (theCallBack !== undefined && args instanceof Array) {

        if (args[0] === 'samsaara.self') {
            args[0] = executor;
        }

        if (typeof arguments[arguments.length - 1] === 'function') {
            args.push(arguments[arguments.length - 1]);
        }

        theCallBack.executeCallBack(executor.id, executor, args);
    }
};


// Exposed CallBack Execution Error Method
// Allows the client to execute an indexed method that was stored for callback

CommunicationController.prototype.callItBackError = function(executor, callBackID, args) {

    debug(uuid, executor.id, 'CallBack Error Function Handler', callBackID, args);

    var theCallBack = this.incoming_callbacks[callBackID];

    if (theCallBack !== undefined) {

        if (args[0] === 'samsaara.self') {
            args[0] = executor;
        }

        theCallBack.callBackError(executor.id, executor, args);
    }
};


CommunicationController.prototype.createNamespace = function(namespace_name, methods) {

    this.nameSpaces[namespace_name] = new NameSpace(namespace_name, methods);
    return nameSpaces[namespace_name];
};

CommunicationController.prototype.nameSpace = function(namespace_name) {
    return this.nameSpaces[namespace_name];
};



exports = module.exports = CommunicationController;
