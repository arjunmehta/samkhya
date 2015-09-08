var test = require('tape').test;
var shim = require('es5-shim');
var samsaara = require('../client');

// var WebSocket = require('ws');
var WebSocket = require('ws');
var ws;

test('Samsaara Client Exists', function(t) {
    t.equal(typeof samsaara, 'object');
    t.end();
});

test('Samsaara has base methods', function(t) {
    t.equal(typeof samsaara.use, 'function');
    t.equal(typeof samsaara.initialize, 'function');
    t.end();
});

test('Samsaara has execution export methods', function(t) {
    t.equal(typeof samsaara.nameSpace, 'function');
    t.equal(typeof samsaara.createNamespace, 'function');
    t.equal(typeof samsaara.expose, 'function');
    t.end();
});


test('Samsaara initializes', function(t) {
    ws = new WebSocket('ws://localhost:8080');

    samsaara.initialize({
        socket: ws
    });

    samsaara.on('initialized', function(success) {
        console.log('Samsaara is initialized');
        t.equal(success, true);
        t.end();
    });
});


test('Quit websocket', function(t) {
    ws.close();
    t.end();
});


// test('Samsaara can initialize', function(t) {
//     var initialized = samsaara.initialize({
//         socket: ws
//     });
//     t.equal(initialized, samsaara);
//     t.end();
// });

// test('Samsaara has core', function(t) {
//     t.equal(typeof samsaara.core, 'object');
//     t.end();
// });

// test('Samsaara has core', function(t) {
//     t.equal(typeof samsaara.core.execute, 'function');
//     t.equal(typeof samsaara.core.executeRaw, 'function');
//     t.equal(typeof samsaara.core.nameSpace, 'function');
//     t.equal(typeof samsaara.core.close, 'function');
//     t.equal(typeof samsaara.core.setState, 'function');
//     t.end();
// });
