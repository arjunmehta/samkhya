var core,
    incomingCallbacks;

var helper = require('./util/helper');

var convertToObj = helper.convertToObj,
    makeUniqueCallBackID = helper.makeUniqueCallBackID;


function initialize(samsaaraCore, communicationCtrl) {

    core = samsaaraCore;
    incomingCallbacks = communicationCtrl.incomingCallbacks;

    return IncomingCallBack;
}


function IncomingCallBack(theCallBack, executorArray) {
    this.callback_id = makeUniqueCallBackID();
    this.callBack = theCallBack;
    this.executor_list = convertToObj(executorArray);
    this.executor_count = executorArray.length;
}


IncomingCallBack.prototype.addConnections = function(executorArray) {
    var i;

    for (i = 0; i < executorArray.length; i++) {
        this.executor_list[executorArray[i]] = true;
    }

    this.executor_count += executorArray.length;
};

IncomingCallBack.prototype.addConnection = function(executorID) {

    this.executor_list[executorID] = true;
    this.executor_count++;
};

IncomingCallBack.prototype.executeCallBack = function(executorID, executor, args) {

    if (this.executor_list[executorID] !== undefined) {

        this.callBack.apply(executor, args);
        this.executor_list[executorID] = undefined;
        this.executor_count--;
        this.evaluateDestroy();
    }
};

IncomingCallBack.prototype.callBackError = function(executorID) {

    if (this.executor_list[executorID] !== undefined) {

        this.executor_list[executorID] = undefined;
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
    incomingCallbacks[this.callback_id] = undefined;
};


module.exports = {
    initialize: initialize,
    Constructor: IncomingCallBack
};
