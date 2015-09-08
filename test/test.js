var samsaara = require('../main');
var WebSocketServer = require('ws').Server;

var test = require('tape').test;

var wss = new WebSocketServer({
    port: 8080
});


test('Samsaara Server Exists', function(t) {
    t.equal(typeof samsaara, 'object');
    t.end();
});

test('Samsaara has base methods', function(t) {
    t.equal(typeof samsaara.use, 'function');
    t.equal(typeof samsaara.initialize, 'function');
    t.end();
});

test('Samsaara has connection control methods', function(t) {
    t.equal(typeof samsaara.connection, 'function');
    t.equal(typeof samsaara.newConnection, 'function');
    t.end();
});

test('Samsaara has execution export methods', function(t) {
    t.equal(typeof samsaara.nameSpace, 'function');
    t.equal(typeof samsaara.createNamespace, 'function');
    t.equal(typeof samsaara.expose, 'function');
    t.end();
});

test('Samsaara can initialize', function(t) {
    var initialized = samsaara.initialize();
    t.equal(initialized, samsaara);
    t.end();
});

test('Samsaara initializes a connection', function(t) {
    var connection;

    wss.on('connection', function(ws) {
        connection = samsaara.newConnection(ws);
        connection.on('initialized', function(success) {
            t.equal(success, true);
            t.end();
        });
    });
});

test('Close Test', function(t) {
    wss.close();
    t.end();
});
