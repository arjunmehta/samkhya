var samsaara = require('../client');
var samsaaraMiddlewareTester = require('./middleware_tester');

var WebSocket = require('ws');
var test = require('tape').test;
var shim = require('es5-shim');

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

test('Samsaara can load middleware', function(t) {
    samsaara.use(samsaaraMiddlewareTester);
    t.end();
});

test('Samsaara initializes', function(t) {
    ws = new WebSocket('ws://localhost:8080');

    samsaara.initialize({
        socket: ws
    });

    t.equal(typeof samsaara.core, 'object');

    samsaara.on('initialized', function(success) {
        console.log('Samsaara is initialized');
        t.equal(success, true);
        t.equal(typeof samsaara.core.execute, 'function');
        t.equal(typeof samsaara.core.executeRaw, 'function');
        t.equal(typeof samsaara.core.nameSpace, 'function');
        t.equal(typeof samsaara.core.close, 'function');
        t.equal(typeof samsaara.core.setState, 'function');
        t.end();
    });
});

test('Samsaara exposes a method that gets called', function(t) {
    samsaara.expose({
        testMethod: function(testString, cb) {
            t.equal(testString, 'testing123');
            t.equal(typeof cb, 'function');
            cb(
                true,
                'success', [true, 'success', [{
                    success: true
                }]], {
                    successFactor: 400
                }
            );
            t.end();
        }
    });
});

test('Samsaara handles double callback', function(t) {
    samsaara.expose({
        doubleCallback: function(cb) {
            t.equal(typeof cb, 'function');
            cb(function(cb2) {
                t.equal(typeof cb2, 'function');
                cb2();
                t.end();
            });
        }
    });
});

test('Quit websocket', function(t) {
    ws.close();
    t.end();
});
