var samsaara = (function(samsaara){

  samsaara = new EventEmitter();

  var samsaaraID,
      samsaaraToken,
      samsaaraOwner,
      preinitialized = false;

  var remoteOptions = {};
  var options;

  var sockjs_url = '/echo';
  var sockjs = {};
  var sockConnectionTimerTime = 0;
  var sockConnectionTimer = null;

  var heartBeat = {};

  var functionQueue = [];
  var outgoingCallBacks = {};
  var incomingCallBacks = {};
  var internalMethods = {};
  var exposedMethods = {};

  var navInfo = {
    // browserName: BrowserDetect.browser,
    // browserVersion: BrowserDetect.version,
    // OSName: BrowserDetect.OS,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    timeOffset: 0,
    sessionInfo: {id: "anon" + makeIdAlpha(15), name: "user" + makeIdAlpha(15)}
  };


  /**
   * Public Methods
   **/

  samsaara.initialize = function(opts){

    options = opts;

    if(opts){
      if(opts.geoLocation){
        remoteOptions.geoLocation = opts.geoLocation;
      }
      if(opts.timeOffset){
        remoteOptions.timeOffset = opts.timeOffset;
      }
      if(opts.groups){
        remoteOptions.groups = opts.groups;
      }
      if(opts.windowSize){
        remoteOptions.windowSize = opts.windowSize;
        window.onresize = function(e){
          send( {internal:"windowResize", args:[window.innerWidth, window.innerHeight] } );
        };
      }
      if(opts.socksURL){
        sockjs_url = opts.socksURL;
      }
    }

    initSock();

  };

  samsaara.expose = function(set){
    for(var func in set){
      exposedMethods[func] = set[func];
    }
  };

  samsaara.addInternalMethod = function(name, func){
    if(!internalMethods[name]){
      internalMethods[name] = func;
    }
  };

  samsaara.use = function(module){

    // console.log("Trying to use", module);

    for(var methodName in module.internalMethods){

      console.log("Trying to use:", methodName);
      if(!internalMethods[methodName]){
        internalMethods[methodName] = module.internalMethods[methodName];
      }
    }
  };


  /**
   * Private/Public Methods
   **/

  var func = samsaara.func = function(fname){
    var args = arguments;
    var packet = {};    
    packet.func = fname;

    processAndSend(1, packet, args, samsaaraOwner);
  };

  var nsFunc = samsaara.nsFunc = function(ns, fname){
    var args = arguments;
    var packet = {};    
    packet.ns = ns;
    packet.func = fname;

    processAndSend(2, packet, args, samsaaraOwner);
  };

  function processAndSend(offset, packet, args, owner){
    if(args.length > offset){
      packet.args = [];
      for(var i = offset; i < args.length-1; i++){
        packet.args.push(args[i]);
      }
      if(typeof args[args.length-1] === "function"){
        send(packet, owner, args[args.length-1]);
      }
      else{
        packet.args.push(args[args.length-1]);
        send(packet, owner);
      }
    }
    else{
      send(packet, owner);
    }
  }

  var send = function(packetJSON, owner, callBack){

    if(typeof callBack === "function"){
      var callBackID = makeIdAlpha(12);
      incomingCallBacks[callBackID] = {callBack: callBack};
      packetJSON.callBack = callBackID;
    }

    if(preinitialized === true){
      packetJSON.token = samsaaraToken;
      // if(packetJSON.owner !== undefined && packetJSON.owner !== samsaaraOwner)
      sockjs.send( JSON.stringify([owner, packetJSON]) );
      // console.log("SENDING", JSON.stringify([owner, packetJSON]));
    }
    else{
      functionQueue.push( packetJSON );
    }
  };

  var nsSend = function(ns, packet, callBack){
    packet.ns = ns;
    send(packet, callBack);
  };

  /**
   * Private Methods
   **/

  var initSock = function(){

    sockjs = new SockJS(sockjs_url);

    sockjs.onopen = function(){
      console.log('[*] open', sockjs.protocol);

      sockConnectionTimerTime = 0;

      clearInterval(heartBeat);
      heartBeat = setInterval(heartBeater, 10000);

      if(options && options.session){
        // console.log("*******************ATTEMPTING TO LOG IN SESSION");
        send({internal: "requestRegistrationToken"}, samsaaraOwner, function (err, registrationToken){
          httpGet("/registerSamsaaraConnection?regtoken=" + registrationToken, function (sessionInfo){
            var sessionInfoParsed = JSON.parse(sessionInfo);
            if(sessionInfo.err === undefined){
              navInfo.sessionInfo = {sessionID: sessionInfoParsed.sessionID, userID: sessionInfoParsed.userID};
              sockjs.send( JSON.stringify( [samsaaraOwner, {login: [registrationToken, sessionInfo]}] ));
            }
          });
        });
      }
      
    };

    sockjs.onmessage = function(e){
      var messageParsed = {};
      try{
        console.log("INCOMING MESSAGE", e.data);
        messageParsed = JSON.parse(e.data);           
      }
      catch(err){
        console.log(err);
      }
      evalMessage(messageParsed);
    };

    sockjs.onclose = function(e){
      console.log('[*] close');
      preinitialized = false;

      sockConnectionTimer = setTimeout(function(){
        var timeoutTime = sockConnectionTimerTime >= (15000/2) ? 15000 : (sockConnectionTimerTime*2 + 400);
        sockConnectionTimerTime = timeoutTime;

        initSock();
      }, sockConnectionTimerTime);
    };
  };

  var heartBeater = function(){
    sockjs.send('H');
  };

  var evalMessage = function (messageParsed){

    var messageObj = messageParsed[1];
    messageObj.owner = messageParsed[0];


    if(messageObj.samsaaraID !== undefined){
      samsaaraID = messageObj.samsaaraID;
      console.log("CONNECTED AS:" + samsaaraID);
    }
    if(messageObj.samsaaraOwner !== undefined){
      samsaaraOwner = messageObj.samsaaraOwner;
      sockjs.send( JSON.stringify( [samsaaraOwner, {opts: remoteOptions}] ));
      console.log("samsaaraOwner:" + samsaaraOwner);
    }
    if(messageObj.samsaaraToken !== undefined){
      preinitializeWithToken(messageObj.samsaaraToken);
    }

    if(messageObj.func !== undefined){
      if(exposedMethods[messageObj.func] !== undefined){
        execute(exposedMethods[messageObj.func], messageObj);
      }
      else{
        console.log("Samsaara Error:", messageObj.func, "Is not a valid property of this Samsaara Object", messageObj);
        if(messageObj.callBack){
          send({internal: "callItBackError", args: [messageObj.callBack, messageObj.owner, ["ERROR: Invalid Object on Client"]]}, messageObj.owner);
        }
      }
    }

    if(messageObj.internal !== undefined){
      if(internalMethods[messageObj.internal] !== undefined){
        execute(internalMethods[messageObj.internal], messageObj);
      }
      else{
        console.log("Samsaara Error:", messageObj.internal, "Is not a valid property of this Samsaara Object");
      }
    }
  };

  function preinitializeWithToken(token){
    samsaaraToken = token;
    console.log("Token Received:", samsaaraToken);

    if(preinitialized === false){
      preinitialized = true;
      if(functionQueue.length > 0){
        for(var i=0; i < functionQueue.length; i++){
          send( functionQueue[i], samsaaraOwner);
        }
        functionQueue = [];
      }
    }
  }

  function execute(func, messageObj){
    if(messageObj.callBack !== undefined){

      var callBackID = messageObj.callBack;
      var theCallBack = outgoingCallBacks[callBackID] = createCallBack(callBackID, messageObj.owner);

      if(messageObj.args === undefined){
        messageObj.args = [];
      }
      messageObj.args.push(outgoingCallBacks[callBackID]);
    }
    func.apply(samsaara, messageObj.args);
  }

  function createCallBack(id, owner){
    var theCallBack = function(){
      var args = Array.prototype.slice.call(arguments);
      if(typeof args[args.length-1] === "function"){
        theCallBack = args.pop();
        processAndSend(0, {ns:"internal", func:"callItBack"}, [id, owner, args, theCallBack], owner);
      }
      else{
        processAndSend(0, {ns:"internal", func:"callItBack"}, [id, owner, args], owner);
      }
      
      // send({internal: "callItBack", args: [id, owner, args] } );
      delete outgoingCallBacks[id];
    };
    return theCallBack;
  }


  /**
   * Exposed Internal Methods
   **/

  internalMethods.callItBack = function(id, owner, args){
    // console.log("CALL IT BACK", id, owner, args);
    // console.log("CALL IT BACK", incomingCallBacks);
    incomingCallBacks[id].callBack.apply(incomingCallBacks[id].from, args);
    delete incomingCallBacks[id];
  };

  internalMethods.reportError = function(code, message){
    console.log("ARGYLE SERVER ERROR:", code, message);
  };

  internalMethods.samsaaraInitialized = function(initialized, callBack){
    samsaara.emitEvent("initialized");
    if(typeof callBack === "function") callBack(true);
  };

  internalMethods.updateToken = function(oldToken, newToken, callBack){
    console.log("UPDATING TOKEN", oldToken, newToken);

    if(samsaaraToken === oldToken){
      samsaara.emitEvent("authenticated", [navInfo.sessionInfo.userID]);
      samsaaraToken = newToken;
      if(typeof callBack === "function") callBack(newToken);
    }
    else{
      if(typeof callBack === "function") callBack(false);
    }
  };


  /**
   * Helper Methods
   **/

  function makeIdAlpha(idLength){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for( var i=0; i < idLength; i++ ){
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  function httpGet(theUrl, callBack){
    var xmlHttp = null;

    xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", theUrl, false );
    xmlHttp.send( null );

    if(callBack) callBack(xmlHttp.responseText);
    else return xmlHttp.responseText;
  }

  //Browser Detect Script: http://www.quirksmode.org/js/detect.html

  var BrowserDetect = {
    init: function () {
      this.browser = this.searchString(this.dataBrowser) || "An unknown browser";
      this.version = this.searchVersion(navigator.userAgent) || this.searchVersion(navigator.appVersion) || "an unknown version";
      this.OS = this.searchString(this.dataOS) || "an unknown OS";
    },
    searchString: function (data) {
      for (var i=0;i<data.length;i++)  {
        var dataString = data[i].string;
        var dataProp = data[i].prop;
        this.versionSearchString = data[i].versionSearch || data[i].identity;
        if (dataString) {
          if (dataString.indexOf(data[i].subString) != -1)
            return data[i].identity;
        }
        else if (dataProp)
          return data[i].identity;
      }
    },
    searchVersion: function (dataString) {
      var index = dataString.indexOf(this.versionSearchString);
      if (index == -1) return;
      return parseFloat(dataString.substring(index+this.versionSearchString.length+1));
    },
    dataBrowser: [
      {
        string: navigator.userAgent,
        subString: "Chrome",
        identity: "Chrome"
      },
      {
         string: navigator.userAgent,
        subString: "OmniWeb",
        versionSearch: "OmniWeb/",
        identity: "OmniWeb"
      },
      {
        string: navigator.vendor,
        subString: "Apple",
        identity: "Safari",
        versionSearch: "Version"
      },
      {
        prop: window.opera,
        identity: "Opera",
        versionSearch: "Version"
      },
      {
        string: navigator.vendor,
        subString: "iCab",
        identity: "iCab"
      },
      {
        string: navigator.vendor,
        subString: "KDE",
        identity: "Konqueror"
      },
      {
        string: navigator.userAgent,
        subString: "Firefox",
        identity: "Firefox"
      },
      {
        string: navigator.vendor,
        subString: "Camino",
        identity: "Camino"
      },
      {    // for newer Netscapes (6+)
        string: navigator.userAgent,
        subString: "Netscape",
        identity: "Netscape"
      },
      {
        string: navigator.userAgent,
        subString: "MSIE",
        identity: "Explorer",
        versionSearch: "MSIE"
      },
      {
        string: navigator.userAgent,
        subString: "Gecko",
        identity: "Mozilla",
        versionSearch: "rv"
      },
      {     // for older Netscapes (4-)
        string: navigator.userAgent,
        subString: "Mozilla",
        identity: "Netscape",
        versionSearch: "Mozilla"
      }
    ],
    dataOS : [
      {
        string: navigator.platform,
        subString: "Win",
        identity: "Windows"
      },
      {
        string: navigator.platform,
        subString: "Mac",
        identity: "Mac"
      },
      {
        string: navigator.userAgent,
        subString: "iPhone",
        identity: "iPhone/iPod"
      },
      {
        string: navigator.platform,
        subString: "Linux",
        identity: "Linux"
      }
    ]
  };

  BrowserDetect.init();

  return samsaara;

}(this.samsaara = this.samsaara || {}));


var testTime = (function(module){

  module.internalMethods = {
    testTime: function(stopTime, serverTime, callBack){
      var serverOffset = serverTime - stopTime;
      var theTime = new Date().getTime();
      var errorDifference = theTime - serverOffset;

      if(typeof callBack === "function") callBack(serverTime, theTime, errorDifference);
    },
    updateOffset: function (timeOffset){
      console.log("Samsaara: updateOffset():", timeOffset);
      samsaara.timeOffset = timeOffset;
    }
  };

  module.initializationMethods = {};
  module.closeMethods = {};

  return module;

}(this.testTime = this.testTime || {}));



var navInfo = (function(module){

  module.internalMethods = {
    getNavInfo: function(callBack){
      if(typeof callBack === "function") callBack( {empty: 0} );
    }
  };

  module.initializationMethods = {};
  module.closeMethods = {};

  return module;

}(this.navInfo = this.navInfo || {}));

var groups = (function(module){

  module.internalMethods = {
    addToGroups: function(callBack){
      if(typeof callBack === "function") callBack( options.groups );
    }
  };

  module.initializationMethods = {};
  module.closeMethods = {};

  return module;

}(this.groups = this.groups || {}));


var geoLocation = (function(module){

  module.internalMethods = {

    getGeoLocation: function(callBack){
      if (navigator.geolocation){
        navigator.geolocation.getCurrentPosition(function (position){
          samsaara.geoposition = position;
          if(typeof callBack === "function") callBack(null, position);
        }, function(err){
          if(typeof callBack === "function") callBack(err, null);
        });
      }
    }

  };

  module.initializationMethods = {};
  module.closeMethods = {};

  return module;

}(this.geoLocation = this.geoLocation || {}));


var windowSize = (function(module){

  module.internalMethods = {
    getWindowSize: function(callBack){
      if(typeof callBack === "function") callBack(window.innerWidth, window.innerHeight);
    }
  };

  module.initializationMethods = {};
  module.closeMethods = {};

  return module;

}(this.windowSize = this.windowSize || {}));

console.log("windowSize", windowSize);

samsaara.use(windowSize);
samsaara.use(geoLocation);
samsaara.use(testTime);
samsaara.use(navInfo);
samsaara.use(groups);


function getScreenInfo(){

  var displayObject = {};

  displayObject.screenX = window.screenX;
  displayObject.screenY = window.screenY;

  displayObject.displayWidth = window.screen.width;
  displayObject.displayHeight = window.screen.height;

  displayObject.displayAvailWidth = window.screen.availWidth;
  displayObject.displayAvailHeight = window.screen.availHeight;

  displayObject.displayAvailLeft = window.screen.availLeft;
  displayObject.displayAvailTop = window.screen.availTop;

  displayObject.innerWidth = window.innerWidth;
  displayObject.innerHeight = window.innerHeight;

  displayObject.outerWidth = window.outerWidth;
  displayObject.outerHeight = window.outerHeight;

  if(self.navInfo.displayCalibrated){
    displayObject.calibratedX = self.navInfo.displayCalibrated.X;
    displayObject.calibratedY = self.navInfo.displayCalibrated.Y;
  }

  displayObject.totalDisplayWidth = 0;

}

