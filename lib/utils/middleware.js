var connectionController = require('../controllers/connectionController');
var routeController = require('../controllers/routeController');

var core;

var modules = {};
var initializedModules = [];
var capability = {};


var middlewareLoader = {

    capability: capability,

    initialize: function(samsaaraCore) {
        core = samsaaraCore;
    },

    use: function(module) {

        if (typeof module.name === 'string' && typeof module.initialize === 'function') {
            modules[module.name] = module;
        } else {
            console.error('Module is not a valid samsaara middleware module.');
        }

        return core;
    },

    load: function() {

        var moduleName,
            i;

        for (moduleName in modules) {
            capability[moduleName] = true;
        }

        for (moduleName in modules) {
            initializeModule(modules[moduleName]);
        }

        for (i = 0; i < initializedModules.length; i++) {
            finalizeModule(initializedModules[i]);
        }
    }
};


function initializeModule(middleware) {

    var initializedModule = middleware.initialize(core, capability);
    var moduleName = initializedModule.name;

    initializedModules.push(moduleName, initializedModule);

    // Gives samsaara a namespace for the middleware. (ie. samsaara.groups, samsaara.authentication etc.)

    if (moduleName) {
        capability[moduleName] = true;

        if (!core[moduleName]) {
            core[moduleName] = {};
        }
    } else {
        throw new Error('samsaara middleware requires a unique name.');
    }

    addCoreMethods(moduleName, initializedModule);
    addModuleMethods(moduleName, initializedModule);
    addRemoteMethods(moduleName, initializedModule);

    addConnectionPreInitialization(moduleName, initializedModule);
    addConnectionInitialization(moduleName, initializedModule);
    addConnectionClose(moduleName, initializedModule);

    addPreRouteFilter(moduleName, initializedModule);
    addMessageRoutes(moduleName, initializedModule);
}


// Add methods to expose on samsaara for local access. These must be uniquely named.
// ie. samsaara.group('group_name')

function addCoreMethods(moduleName, initializedModule) {

    var methods = initializedModule.coreMethods,
        method;

    for (method in methods) {
        if (!core[method]) {
            core[method] = methods[method];
        } else {
            throw new Error('Foundation method or object: ' + method + ' is already an internal object or method name on samsaara');
        }
    }
}


// Adds new methods in the middleware to the module's own namespace.
// ie. samsaara.groups.group();

function addModuleMethods(moduleName, initializedModule) {

    var methods = initializedModule.moduleMethods,
        methodName;

    for (methodName in methods) {
        if (moduleName) {
            core[moduleName][methodName] = methods[methodName];
        }
    }
}


// Adds remotely accessible methods to samsaara's internal namespace. (Should be configurable)
// ie. samsaara.execute('sendToGroup')

function addRemoteMethods(moduleName, initializedModule) {

    var methods = initializedModule.remoteMethods;
    if (methods) {
        core.nameSpace('internal').expose(methods);
    }
}


// Adds methods to execute when a new connection is made but not initialized yet.

function addConnectionPreInitialization(moduleName, initializedModule) {

    if (typeof initializedModule.connectionPreInitialization === 'function') {
        connectionController.addPreinitialization(initializedModule.connectionPreInitialization);
    }
}


// Adds methods to execute to initialize a connection.

function addConnectionInitialization(moduleName, initializedModule) {

    var forced = initializedModule.forceInitialization;

    if (typeof initializedModule.connectionInitialization === 'function') {
        connectionController.addInitialization(moduleName, initializedModule.connectionInitialization, forced);
    }
}


// Adds methods to execute when a connection is closed.

function addConnectionClose(moduleName, initializedModule) {

    if (typeof initializedModule.connectionClose === 'function') {
        connectionController.addClosing(initializedModule.connectionClose);
    }
}


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

function addPreRouteFilter(moduleName, initializedModule) {

    if (typeof initializedModule.preRouteFilter === 'function') {
        routeController.addPreRouteFilter(initializedModule.preRouteFilter);
    }
}


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

function addMessageRoutes(moduleName, initializedModule) {

    var routes = initializedModule.messageRoutes,
        routeName;

    for (routeName in routes) {
        routeController.addRoute(routeName, routes[routeName]);
    }
}


// Wraps up any kind of settings after all modules have been added

function finalizeModule(initializedModule) {

    if (typeof initializedModule.finalize === 'function') {
        initializedModule.finalize();
    }
}


module.exports = middlewareLoader;
