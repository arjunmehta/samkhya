var core,
    samsaara_id,
    incoming_callbacks,
    init_offset = 1000,
    callback_id_offset = 0;

var helper = require('../util/util.'),
    convertToObj = helper.convertToObj,
    makeUniqueCallBackID = helper.makeUniqueCallBackID;


function initialize(uuid, samsaara_core, incoming_callbacks) {

    samsaara_id = uuid;
    core = samsaara_core;
    incoming_callbacks = samsaara_core.communication.incoming_callbacks;

    return IncomingCallBack;
}


function IncomingCallBack(theCallBack, executor_array) {
    this.callback_id = makeUniqueCallBackID();
    this.callBack = theCallBack;
    this.executor_list = convertToObj(executor_array);
    this.executor_count = executor_array.length;
}


IncomingCallBack.prototype.addConnections = function(executor_array) {

    for (var i = 0; i < executor_array.length; i++) {
        this.executor_list[executor_array[i]] = true;
    }

    this.executor_count += executor_array.length;
};

IncomingCallBack.prototype.addConnection = function(executor_id) {

    this.executor_list[executor_id] = true;
    this.executor_count++;
};

IncomingCallBack.prototype.executeCallBack = function(executor_id, executor, args) {

    if (this.executor_list[executor_id] !== undefined) {

        this.callBack.apply(executor, args);
        this.executor_list[executor_id] = undefined;
        this.executor_count--;
        this.evaluateDestroy();
    }
};

IncomingCallBack.prototype.callBackError = function(executor_id) {

    if (this.executor_list[executor_id] !== undefined) {

        this.executor_list[executor_id] = undefined;
        this.executor_count--;
        this.evaluateDestroy();
    }
};

IncomingCallBack.prototype.evaluateDestroy = function() {

    if (this.executor_count <= 0) {
        this.destroy();
    }
};

IncomingCallBack.prototype.destroy = function() {
    incoming_callbacks[this.callback_id] = undefined;
};


exports = module.exports = {
    initialize: initialize,
    Constructor: IncomingCallBack
};
