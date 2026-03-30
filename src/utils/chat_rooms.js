const rooms = [];

// Join clients to room
function joinRoom( id, chatId ) {
    const room = { id, chatId };

    rooms.push(room);

    return room;
}

// Get current room
function getCurrentRoom(id) {
    const room = rooms.find( room => room.id === id);
    return room
}

// Client leaves room
function leaveRoom(id){
    const index = rooms.findIndex( room => room.id === id );

    if (index !== -1 ) {
        return rooms.splice(index, 1)[0];
    }
}

module.exports = {
    joinRoom,
    getCurrentRoom,
    leaveRoom
}