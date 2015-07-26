var hardDelimiter = '::',
    hardDelimiterLength = hardDelimiter.length,
    softDelimiter = ':';


// Incoming Methods

function splitPacket(rawPacketWithHeaders) {

    var splitIndex = rawPacketWithHeaders.indexOf(hardDelimiter);
    var headerbits = rawPacketWithHeaders.substr(0, splitIndex).split(softDelimiter);
    var message = rawPacketWithHeaders.slice(hardDelimiterLength + splitIndex);

    return {
        message: message,
        headers: headerbits
    };
}

function parsePacket(rawPacketWithoutHeaders) {
    var parsedPacket;

    try {
        parsedPacket = JSON.parse(rawPacketWithoutHeaders);
    } catch (err) {
        console.error('Message Error: Invalid JSON', rawPacketWithoutHeaders, err);
    }

    return parsedPacket;
}


// Outgoing Methods

function stringifyPacket(headerString, packet) {

    var packetString;

    try {
        packetString = JSON.stringify(packet);
    } catch (err) {
        console.error('Error Sending Packet:', headerString, packet, err);
    }

    return packetString;
}

function addHeadersToPacket(headerArray, stringifiedPacket) {
    return ('' + headerArray.join(softDelimiter) + hardDelimiter + stringifiedPacket);
}


module.exports = {
    splitPacket: splitPacket,
    parsePacket: parsePacket,
    stringifyPacket: stringifyPacket,
    addHeadersToPacket: addHeadersToPacket
};
