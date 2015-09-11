var hardDelimiter = '::';
var hardDelimiterLength = hardDelimiter.length;
var softDelimiter = ':';


var parser = {

    // Incoming Methods

    splitPacket: function(rawPacketWithHeaders) {

        var splitIndex = rawPacketWithHeaders.indexOf(hardDelimiter);
        var headerbits = rawPacketWithHeaders.substr(0, splitIndex).split(softDelimiter);
        var message = rawPacketWithHeaders.slice(hardDelimiterLength + splitIndex);

        return {
            message: message,
            headers: headerbits
        };
    },

    parsePacket: function(rawPacketWithoutHeaders) {
        var parsedPacket;

        try {
            parsedPacket = JSON.parse(rawPacketWithoutHeaders);
        } catch (err) {
            console.error('Message Error: Invalid JSON', rawPacketWithoutHeaders, err);
        }

        return parsedPacket;
    },


    // Outgoing Methods

    stringifyPacket: function(packet) {

        var packetString;

        try {
            packetString = JSON.stringify(packet);
        } catch (err) {
            console.error('Error Stringifying Packet:', packet, err);
        }

        return packetString;
    },

    addHeadersToPacket: function(headerArray, stringifiedPacket) {
        return ('' + headerArray.join(softDelimiter) + hardDelimiter + stringifiedPacket);
    }
};


module.exports = parser;
