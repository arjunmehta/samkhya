var executionController = require('../controllers/executionController');

function ConnectionQueue(connection) {
    this.queue = [];
}

// Object.defineProperty(ConnectionQueue.prototype, 'initialized', {
//     get: function() {
//         var forced = this.forced,
//             moduleName;

//         for (moduleName in forced) {
//             if (forced[moduleName] === false) {
//                 return false;
//             }
//         }
//         return true;
//     }
// });

ConnectionQueue.prototype.addRaw = function(channel, executorArray, packet, cb) {
    var closure = function(routeID) {
        executionController.executeRaw(channel, routeID, executorArray, packet, cb);
    };
    this.queue.push(closure);
};

ConnectionQueue.prototype.add = function(channel, executorArray, namespaceName, funcName, args) {
    var closure = function(routeID) {
        executionController.execute(channel, routeID, executorArray, namespaceName, funcName, args);
    };
    this.queue.push(closure);
};

ConnectionQueue.prototype.emptyToRoute = function(routeID) {
    var i;
    for (i = 0; i < this.queue.length; i++) {
        this.queue[i](routeID);
    }
    this.queue = [];
};


// Closure returns a callback method to be called by middleware when initialized.

function buildInitializedClosure(initializer, moduleName) {
    return function() {
        initializer.initializedModule(moduleName);
    };
}
