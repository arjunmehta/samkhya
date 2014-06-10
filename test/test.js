var http = require('http');
var path = require('path');

var express = require('express');
var app = express();

var server = http.createServer(app);


app.use("/", express.static( path.resolve(__dirname) ));


var samsaara = require('samsaara');
var samsaaraOpts = {
  socketPath: "/samsaaraTest",
  heartBeatThreshold: 11000
};

samsaara.initialize(server, app, samsaaraOpts);


var test = {};

samsaara.createNamespace("test", test);

test.single = function(root, callBack){
  if(typeof callBack === "function") callBack(Math.pow(root, 2));
};

test.double = function(root, callBack){
  if(typeof callBack === "function") callBack(Math.pow(root, 2));
};

test.clientSingle = function(root){
  this.execute("single", root);
};

test.clientDouble = function(root){
  this.execute("double", Math.pow(root, 2), function (value, callBack){
    if(typeof callBack === "function") callBack(Math.pow(value, 2));
  });
};

test.clientTriple = function(root){
  this.execute("triple", Math.pow(root, 2), function (value, callBack){
    if(typeof callBack === "function") callBack(Math.pow(value, 2), function(thirdValue, callBack){
      if(typeof callBack === "function") callBack(Math.pow(thirdValue, 2));
    });
  });
};

samsaara.expose(test);



server.listen(9999);