var core,
    communicationController,
    connectionController,
    router,
    modules;

var Connection = require('./constructors/connection');


function MiddlewareLoader(samsaaraCore, communicationCtrl, connectionCtrl, routeCtrl) {

    core = samsaaraCore;
    communicationController = communicationCtrl;
    connectionController = connectionCtrl;
    router = routeCtrl;

    this.initializedModules = [];
    this.capability = {};
}

MiddlewareLoader.prototype.use = function(module) {

    if (typeof module.name === 'string' && typeof module.initialize === 'function') {
        modules[module.name] = module;
    } else {
        console.error('Module is not a valid samsaara middleware module.');
    }

    return core;
};

MiddlewareLoader.prototype.load = function() {

    var moduleName,
        i;

    for (moduleName in modules) {
        this.capability[moduleName] = true;
    }

    for (moduleName in modules) {
        this.initializeModule(modules[moduleName]);
    }

    for (i = 0; i < this.initializedModules.length; i++) {
        this.finalizeModule(this.initializedModules[i]);
    }
};

MiddlewareLoader.prototype.new = function(newMiddleware) {
    modules.push(newMiddleware);
};

MiddlewareLoader.prototype.initializeModule = function(middleware) {

    var initializedModule = middleware.initialize(core);
    var moduleName = initializedModule.name;

    this.initializedModules.push(moduleName, initializedModule);

    // Gives samsaara a namespace for the middleware. (ie. samsaara.groups, samsaara.authentication etc.)

    if (moduleName) {

        this.capability[moduleName] = true;

        if (!core[moduleName]) {
            core[moduleName] = {};
        }

    } else {

        throw new Error('samsaara middleware requires a unique name.');
    }

    this.addCoreMethods(moduleName, initializedModule);
    this.addModuleMethods(moduleName, initializedModule);
    this.addRemoteMethods(moduleName, initializedModule);

    this.addConnectionPreInitialization(moduleName, initializedModule);
    this.addConnectionInitialization(moduleName, initializedModule);
    this.addConnectionClose(moduleName, initializedModule);

    this.addPreRouteFilter(moduleName, initializedModule);
    this.addMessageRoutes(moduleName, initializedModule);

};


// Add methods to expose on samsaara for local access. These must be uniquely named.
// ie. samsaara.group('group_name')

MiddlewareLoader.prototype.addCoreMethods = function(moduleName, initializedModule) {

    var methods = initializedModule.coreMethods,
        method;

    for (method in methods) {
        if (!core[method]) {
            core[method] = methods[method];
        } else {
            throw new Error('Foundation method or object: ' + method + ' is already an internal object or method name on samsaara');
        }
    }
};


// Adds new methods in the middleware to the module's own namespace.
// ie. samsaara.groups.group();

MiddlewareLoader.prototype.addModuleMethods = function(moduleName, initializedModule) {

    var methods = initializedModule.moduleMethods,
        methodName;

    for (methodName in methods) {
        if (moduleName) {
            core[moduleName][methodName] = methods[methodName];
        }
    }
};


// Adds remotely accessible methods to samsaara's internal namespace. (Should be configurable)
// ie. samsaara.execute('sendToGroup')

MiddlewareLoader.prototype.addRemoteMethods = function(moduleName, initializedModule) {

    var methods = initializedModule.remoteMethods;
    core.nameSpace('internal').expose(methods);
};


// Adds methods to execute when a new connection is made but not initialized yet.

MiddlewareLoader.prototype.addConnectionPreInitialization = function(moduleName, initializedModule) {

    if (typeof initializedModule.addConnectionPreInitialization === 'function') {
        Connection.preInitializationMethods.push(initializedModule.addConnectionPreInitialization);
    }
};


// Adds methods to execute to initialize a connection.

MiddlewareLoader.prototype.addConnectionInitialization = function(moduleName, initializedModule) {

    if (typeof initializedModule.addConnectionInitialization === 'function') {
        Connection.initializationMethods[moduleName] = initializedModule.addConnectionInitialization;
    }
};


// Adds methods to execute when a connection is closed.

MiddlewareLoader.prototype.addConnectionClose = function(moduleName, initializedModule) {

    if (typeof initializedModule.connectionClose === 'function') {
        Connection.closingMethods.push(initializedModule.connectionClose);
    }
};


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

MiddlewareLoader.prototype.addPreRouteFilter = function(moduleName, initializedModule) {

    if (typeof initializedModule.preRouteFilter === 'function') {
        router.preRouteFilters.push(initializedModule.preRouteFilter);
    }
};


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

MiddlewareLoader.prototype.addMessageRoutes = function(moduleName, initializedModule) {

    var routes = initializedModule.messageRoutes,
        route;

    for (route in routes) {
        router.messageRoutes[route] = routes[route];
    }
};


// Wraps up any kind of settings after all modules have been added

MiddlewareLoader.prototype.finalizeModule = function(initializedModule) {

    if (typeof initializedModule.finalize === 'function') {
        initializedModule.finalize();
    }
};


module.exports = function(samsaaraCore, communicationCtrl, connectionCtrl, routeCtrl) {
    return new MiddlewareLoader(samsaaraCore, communicationCtrl, connectionCtrl, routeCtrl);
};
