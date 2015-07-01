var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function makePseudoRandomID() {
    return (Math.random() * 10000).toString(36);
}


module.exports = exports = {

    createPseudoUuid: function makeAlphaNumericalId(idLength) {

        var text = '';

        for (var i = 0; i < idLength; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        return text;
    },


    makeUniqueCallBackID: function makeUniqueCallBackID() {

        callback_id_offset = callback_id_offset++ > 1000000 ? 0 : callback_id_offset;
        return makePseudoRandomID() + samsaara_id + callback_id_offset;
    },


    convertToObj: function convertToObj(array) {

        var obj = {};

        for (var i = 0; i < array.length; i++) {
            obj[array[i]] = true;
        }

        return obj;
    }
};


