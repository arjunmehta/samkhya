var camelcase = require('camelcase');

var executionController = require('../controllers/executionController');
var connectionController = require('../controllers/connectionController');
var routeController = require('../controllers/routeController');

var Connection = require('../constructors/connection');

var parser = require('../utils/parser');

var core;

var modules = {};
var initializedModules = [];
var capability = {};


var middlewareLoader = {

    capability: capability,

    initialize: function(samsaaraCore) {
        core = samsaaraCore;
    },

    use: function(module, options) {

        var moduleName;
        options = options || {};

        if (typeof module.name === 'string' && typeof module.initialize === 'function') {

            moduleName = camelcase(module.name);

            if (modules[moduleName]) {
                throw new Error('A module named ' + moduleName + ' has already been added to Samsaara. You can only use a module once.');
            }

            modules[moduleName] = {
                module: module,
                options: options
            };
        } else {
            throw new Error('Invalid samsaara middleware module loaded.');
        }

        return core;
    },

    load: function() {

        var moduleName;
        var i;

        for (moduleName in modules) {
            capability[moduleName] = true;
        }

        for (moduleName in modules) {
            initializeModule(moduleName, modules[moduleName].module, modules[moduleName].options);
        }

        for (i = 0; i < initializedModules.length; i++) {
            finalizeModule(initializedModules[i]);
        }
    }
};


// Add methods to expose on samsaara for local access. These must be uniquely named.
// ie. samsaara.group('group_name')

function addCoreObjects(moduleName, coreObjects) {

    var objectName;

    for (objectName in coreObjects) {
        if (!core[objectName]) {
            core[objectName] = coreObjects[objectName];
        } else {
            throw new Error('Foundation method or object: ' + objectName + ' is already an internal object or method name on samsaara');
        }
    }
}


// Adds new methods in the middleware to the module's own namespace.
// ie. samsaara.groups.group();

function addModuleMethods(moduleName, moduleMethods) {

    var methodName;

    if (!core[moduleName]) {
        core[moduleName] = {};
    }

    for (methodName in moduleMethods) {
        core[moduleName][methodName] = moduleMethods[methodName];
    }
}


// Adds remotely accessible methods to samsaara's internal namespace. (Should be configurable)
// ie. samsaara.execute('sendToGroup')

function addExposedMethods(moduleName, remoteMethods) {

    if (remoteMethods) {
        core.nameSpace('internal').expose(remoteMethods);
    }
}


// Adds methods to the Connection prototype.

function addConnectionMethods(moduleName, connectionMethods) {

    var methodName;

    for (methodName in connectionMethods) {
        Connection.prototype[methodName] = connectionMethods[methodName];
    }
}



// Adds methods to execute when a new connection is made but not initialized yet.

function addConnectionPreInitialization(moduleName, connectionPreInitialization) {

    if (typeof connectionPreInitialization === 'function') {
        connectionController.addPreinitialization(connectionPreInitialization);
    }
}


// Adds methods to execute to initialize a connection.

function addConnectionInitialization(moduleName, connectionInitialization, forced) {

    if (typeof connectionInitialization === 'function') {
        connectionController.addInitialization(moduleName, connectionInitialization, forced);
    }
}


// Adds methods to execute when a connection is closed.

function addConnectionClose(moduleName, connectionClose) {

    if (typeof connectionClose === 'function') {
        connectionController.addClosing(connectionClose);
    }
}


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

function addPreRouteFilter(moduleName, preRouteFilter) {

    if (typeof preRouteFilter === 'function') {
        routeController.addPreRouteFilter(preRouteFilter);
    }
}


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

function addMessageRoutes(moduleName, routes) {

    var routeName;

    for (routeName in routes) {
        routeController.addRoute(routeName, routes[routeName]);
    }
}


// Initialize a Module

function initializeModule(moduleName, middleware, options) {

    middleware.initialize(generateClosuredExtender(moduleName), capability, options);
    initializedModules.push(middleware);
}


// Wraps up any kind of settings after all modules have been added

function finalizeModule(initializedModule) {

    if (typeof initializedModule.finalize === 'function') {
        initializedModule.finalize();
    }
}


// Wraps an object for the middleware to use to add things to Samsaara

function generateClosuredExtender(moduleName) {

    return {

        core: core,
        connections: connectionController.connections,
        execute: executionController.execute,
        executeRaw: executionController.executeRaw,
        executeFunction: executionController.executeFunction,
        parser: parser,


        addCoreObjects: function(coreObjects) {
            addCoreObjects(moduleName, coreObjects);
        },

        addModuleMethods: function(moduleMethods) {
            addModuleMethods(moduleName, moduleMethods);
        },

        addExposedMethods: function(remoteMethods) {
            addExposedMethods(moduleName, remoteMethods);
        },

        addConnectionMethods: function(connectionMethods) {
            addConnectionMethods(moduleName, connectionMethods);
        },

        addConnectionPreInitialization: function(connectionPreInitialization) {
            addConnectionPreInitialization(moduleName, connectionPreInitialization);
        },

        addConnectionInitialization: function(connectionInitialization, options) {
            options = options || {};
            addConnectionInitialization(moduleName, connectionInitialization, options.forced);
        },

        addConnectionClose: function(connectionClose) {
            addConnectionClose(moduleName, connectionClose);
        },

        addPreRouteFilter: function(preRouteFilter) {
            addPreRouteFilter(moduleName, preRouteFilter);
        },

        addMessageRoutes: function(routes) {
            addMessageRoutes(moduleName, routes);
        }
    };
}


module.exports = middlewareLoader;
