// debug.enable('samsaara:*');
debug.disable();


var executeDone;

var buildCallBack = function(done){
  return function(){
    done();
  };
};


samsaara.expose({

  single: function(arg){
    chai.assert.equal(arg, "Jambalaya", "Executed by Server " + arg);
    executeDone();
  },

  double: function(firstReturnValue, callBack){

    chai.assert.equal(firstReturnValue, Math.pow(5, 2), "First return is " + firstReturnValue);

    callBack(firstReturnValue, function (secondReturnValue){
      chai.assert.equal(secondReturnValue, Math.pow(Math.pow(5, 2), 2), "Second return is " + secondReturnValue);
      executeDone();
    });
  },

  triple: function(firstReturnValue, callBack){
    chai.assert.equal(firstReturnValue, Math.pow(5, 2), "First return is " + firstReturnValue);

    callBack(firstReturnValue, function (secondReturnValue, callBack){

      chai.assert.equal(secondReturnValue, Math.pow(Math.pow(5, 2), 2), "Second return is " + secondReturnValue);

      if(typeof callBack === "function"){
        callBack(secondReturnValue, function (finalValue){

          chai.assert.equal(finalValue, Math.pow( Math.pow( Math.pow(5, 2), 2), 2), "Third return is " + finalValue );          
          executeDone();
        });
      }
    });
  }

});


describe("Initialize Samsaara", function () {

  before(function() {
    var samsaaraOptions = {
      socketPath: "/samsaaraTest"
    };

    samsaara.initialize(samsaaraOptions);

  });

  it("Has initialized", function (done) {
    samsaara.on("initialized", function(){

      chai.assert.equal("init", "init");
      done();

    }, false);      
  });
});


describe("Client to Server Execution", function () {

  it("Shoud execute in core namespace with Callback", function (done) {

    samsaara.execute("single", 36, function(returnValue){

      chai.assert.equal(returnValue, Math.pow(36, 2), "Testing Square Method return Value "+ returnValue);
      done();
    });
  });


  it("Shoud execute in Test Namespace with Callback", function (done) {

    samsaara.nameSpace("test").execute("single", 120, function(returnValue){

      chai.assert.equal(returnValue, Math.pow(120, 2), "Testing Square Method in Test Namespace return Value " + returnValue);
      done();
    });
  });


  it("Should be executed by the server", function (done) {
    executeDone = buildCallBack(done);
    samsaara.nameSpace('test').execute("clientSingle", "Jambalaya");
  });

  it("Should be executed by the server with Double callBack", function (done) {
    executeDone = buildCallBack(done);
    samsaara.nameSpace('test').execute("clientDouble", 5);
  });

  it("Should be executed by the server with Triple callBack", function (done) {
    executeDone = buildCallBack(done);
    samsaara.nameSpace('test').execute("clientTriple", 5);
  });


});