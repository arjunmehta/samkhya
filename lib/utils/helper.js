var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
var callbackIDOffset = 0;


var helper = {

    createPseudoUuid: function(idLength) {

        var text = '',
            i;

        for (i = 0; i < idLength; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        return text;
    },

    makeUniqueCallBackID: function(samsaaraID) {

        callbackIDOffset = callbackIDOffset++ > 1000000 ? 0 : callbackIDOffset;
        return makePseudoRandomID() + samsaaraID + callbackIDOffset;
    },

    convertToObj: function(array) {

        var obj = {};
        var i;

        for (i = 0; i < array.length; i++) {
            obj[array[i]] = true;
        }

        return obj;
    },

    addReadOnlyBaseProperty: function(obj, name, value) {
        Object.defineProperty(obj, name, {
            enumerable: false,
            configurable: false,
            writable: false,
            value: value
        });
    },

    addWritableBaseProperty: function(obj, name, value) {
        Object.defineProperty(obj, name, {
            enumerable: false,
            configurable: false,
            writable: true,
            value: value
        });
    }
};


function makePseudoRandomID() {
    return (Math.random() * 10000).toString(36);
}


module.exports = helper;
