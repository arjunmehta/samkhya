/*!
 * nodeSymphony - Database Methods
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var helper = require("./helper.js");
var nano = require('nano')('http://localhost:5984');
var argyle;

exports = module.exports = Database;

function Database(parent){

  argyle = parent;

  argyle.getFromDB = function(dbName, docid, callBack){
    nano.request({ db: dbName, doc: docid, method: 'get'}, callBack);
  };

  argyle.getFromDBMulti = function(dbName, docs, callBack){
    nano.request({ db: dbName, path: "_all_docs?include_docs=true", body: {keys: docs}, method: 'post'}, callBack);
  } ; 

  argyle.directStoreToDB = function (dbName, docid, obj, callBack){
    nano.request({ db: dbName, doc: docid, method: 'put', body: obj }, callBack);
  };

  argyle.storeToDB = function (db, docid, obj, callBack){
    updateDoc(db, docid, obj, callBack);
  };

  argyle.updateDoc = function (designName, updateName, docid, formContent, callBack){
    nano.request({ db: this.config.db, doc: '_design/' + designName + '/_update/' + updateName + '/' + docid, method: 'post', form: formContent }, callBack);
  };

}


function updateDoc (dbName, docid, obj, callBack) {

  nano.request({ db: dbName, doc: docid, method: 'get' }, function (err, existing){
    if(!err) obj._rev = existing._rev;
    nano.request({ db: dbName, doc: docid, method: 'put', body: obj }, callBack);
  });

}

