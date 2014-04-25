var samsaara = (function(samsaara){

  samsaara = new EventEmitter();

  var samsaaraID,
      samsaaraToken,
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
          send( {func:"windowResize", args:[window.innerWidth, window.innerHeight] } );
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


  /**
   * Private/Public Methods
   **/

  var func = samsaara.func = function(fname){
    var args = arguments;
    var packet = {};    
    packet.func = fname;

    processAndSend(1, packet, args);
  };

  var nsFunc = samsaara.nsFunc = function(ns, fname){
    var args = arguments;
    var packet = {};    
    packet.ns = ns;
    packet.func = fname;

    processAndSend(2, packet, args);
  };

  function processAndSend(offset, packet, args){
    if(args.length > offset){
      packet.args = [];
      for(var i = offset; i < args.length-1; i++){
        packet.args.push(args[i]);
      }
      if(typeof args[args.length-1] === "function"){
        send(packet, args[args.length-1]);
      }
      else{
        packet.args.push(args[args.length-1]);
        send(packet);
      }
    }
    else{
      send(packet);
    }
  }

  var send = samsaara.send = function(packet, callBack){

    var packetJSON = packet;

    if(callBack !== undefined && typeof callBack === "function"){
      var callBackID = makeIdAlpha(12);
      incomingCallBacks[callBackID] = {callBack: callBack};
      packetJSON.callBack = callBackID;
    }

    if(preinitialized === true){
      packetJSON.token = samsaaraToken;
      sockjs.send( JSON.stringify(packetJSON) );
    }
    else{
      functionQueue.push( packetJSON );
    }
  };

  var nsSend = samsaara.nsSend = function(ns, packet, callBack){
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
        send({func: "requestRegistrationToken"}, function (err, registrationToken){
          httpGet("/registerSamsaaraConnection?regtoken=" + registrationToken, function (sessionInfo){
            var sessionInfoParsed = JSON.parse(sessionInfo);
            if(sessionInfo.err === undefined){
              navInfo.sessionInfo = {sessionID: sessionInfoParsed.sessionID, userID: sessionInfoParsed.userID};
              sockjs.send( JSON.stringify( { login: [registrationToken, sessionInfo] } ));
            }
          });
        });
      }

      sockjs.send( JSON.stringify( { opts: remoteOptions } ));
    };

    sockjs.onmessage = function(e){
      var messageObj = {};
      try{
        messageObj = JSON.parse(e.data);        
      }
      catch(err){
        console.log(err);
      }
      evalMessage(messageObj);
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

  var evalMessage = function (messageObj){

    if(messageObj.samsaaraID !== undefined){
      samsaaraID = messageObj.samsaaraID;
      console.log("CONNECTED AS:" + samsaaraID);
    }

    if(messageObj.samsaaraToken !== undefined){
      preinitializeWithToken(messageObj.samsaaraToken);
    }

    if(messageObj.func !== undefined){
      if(exposedMethods[messageObj.func] !== undefined){
        execute(exposedMethods[messageObj.func], messageObj);
      }
      else{
        console.log("Samsaara Error:", messageObj.func, "Is not a valid property of this Samsaara Object");
      }
    }

    if(messageObj.internal !== undefined){
      if(internalMethods[messageObj.internal] !== undefined){
        execute(internalMethods[messageObj.internal], messageObj);
      }
      else{
        console.log("Samsaara Error:", messageObj.func, "Is not a valid property of this Samsaara Object");
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
          send( functionQueue[i] );
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
      send({func: "callItBack", args: [id, owner, args] } );
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

  internalMethods.testTime = function(stopTime, serverTime, callBack){
    var serverOffset = serverTime - stopTime;
    var theTime = getCurrentTime();
    var errorDifference = theTime - serverOffset;

    if(typeof callBack === "function") callBack(serverTime, theTime, errorDifference);
  };

  internalMethods.updateOffset = function(timeOffset){
    console.log("Samsaara: updateOffset():", timeOffset);
    navInfo.timeOffset = timeOffset;
  };

  internalMethods.getNavInfo = function(callBack){
    if(typeof callBack === "function") callBack( navInfo );
  };

  internalMethods.addToGroups = function(callBack){
    if(typeof callBack === "function") callBack( options.groups );
  };

  internalMethods.getGeoLocation = function(callBack){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(function (position){
        navInfo.geoposition = position;
        if(typeof callBack === "function") callBack(null, navInfo.geoposition);
      }, function(err){
        if(typeof callBack === "function") callBack(err, null);
      });
    }
  };

  internalMethods.getWindowSize = function(callBack){
    if(typeof callBack === "function") callBack(window.innerWidth, window.innerHeight);
  };

  internalMethods.samsaaraInitialized = function(whichOne, callBack){
    samsaara.emitEvent("initialized");
    if(typeof callBack === "function") callBack(whichOne);
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

  function getCurrentTime(){
    var currentTime = new Date().getTime();
    return currentTime;
  }

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

