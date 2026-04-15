require('dotenv').config()

const https = require('https')
const fs = require('fs')

const app = require('./app')

const GoogleCloudPlatform = require('./GoogleCloudPlatform/GCP-BigQuery-Youkti')
const ChatController = require('./controllers/api/chat/chat.controller')

const DealsAutoProcess = require('./utils/deals_autoClosed')

const { BEANSTALK_ENVIRONMENT,
    BEANSTALK_SERVER_VERSION,
    BEANSTALK_GCP_BIGQUERY_PROJECTID,
    BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

GoogleCloudPlatform.connectBigQuery({ projectId: BEANSTALK_GCP_BIGQUERY_PROJECTID, datasetId: BEANSTALK_GCP_BIGQUERY_DATASETID })

app.listen(app.get('port'), () => {
    console.log('[Beanstalk] :: API Server running on port:', app.get('port'))
    console.log('[Beanstalk] :: API Version:', BEANSTALK_SERVER_VERSION)
})

console.log('[Beanstalk] :: Enviroment:', BEANSTALK_ENVIRONMENT) 
if (BEANSTALK_ENVIRONMENT == 'production') {
    // Htmls
    const httpsServer = https.createServer({
        key: fs.readFileSync('/etc/letsencrypt/live/beanstalk.app/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/beanstalk.app/fullchain.pem'),
    }, app)

    httpsServer.listen(443, () => {
        console.log('[Beanstalk] :: [HTTPS] Server running on port 443');
    });

    // Socket.io
    // const http = require('http').Server(app)
    const io = require('socket.io')(httpsServer, {
        cors: {
            origin: true,
            credentials: true,
            methods: ['GET', 'POST']
        }
    })

    const { joinRoom, getCurrentRoom, leaveRoom } = require('./utils/chat_rooms')

    io.on('connection', (socket) => {

        socket.on('joinPrivateChat', (chatId) => {

            const client = joinRoom(socket.id, chatId);

            socket.join(client.chatId);

            console.log(`[Beanstalk] :: [New connection detected... in SocketId (${chatId})]`)

            socket.emit('message', `Welcome to Beanstalk room -> [${chatId}]`);

            socket.broadcast.to(client.chatId).emit('message', `A Client has joined the chat room [${chatId}]`);

            socket.broadcast.to(client.chatId).emit('chatConnected', `Chat Dispensary Connected`);
        })

        socket.on("sendMessage", (message) => {
            
            const client = getCurrentRoom(socket.id)

            if (client !== undefined) {
                ChatController.chatSaveMessage(message.chatid, message.message);
                socket.to(client.chatId).emit("receiveMessage", message.message)
            }
        })

        socket.on('markReadMessage', (message) => {

            if (message !== undefined) {
                ChatController.chatMarkReadMessage(message.chatId, message.kind);
            }
        })

        socket.on('leavePrivateChat', () => {

            const client = leaveRoom(socket.id);

            if (client !== undefined) {
                socket.leave(client.chatId);
                io.to(client.chatId).emit('message', `A Client has left the chat room [${client.chatId}]`);
            }
        })

        socket.on('disconnect', () => {

            const client = leaveRoom(socket.id);

            if (client !== undefined) {
                io.to(client.chatId).emit('message', `A Client has left the chat room [${client.chatId}]`);
            }
        })
    })

} else {
    // Socket.io
    const http = require('http').Server(app)
    const io = require('socket.io')(http, {
        cors: {
            origin: true,
            credentials: true,
            methods: ['GET', 'POST']
        }
    })
    http.listen(3000, () => {
        console.log('[Beanstalk] :: [Socket.io] : listen port: 3000')
    })

    const { joinRoom, getCurrentRoom, leaveRoom } = require('./utils/chat_rooms')

    io.on('connection', (socket) => {

        socket.on('joinPrivateChat', (chatId) => {

            const client = joinRoom(socket.id, chatId);

            socket.join(client.chatId);

            console.log(`[Beanstalk] :: [New connection detected... in SocketId (${client})]`)

            socket.emit('message', `Welcome to Beanstalk room -> [${chatId}]`);

            // var clients = io.socket.clients(client.chatId);

            // var clients= io.sockets.adapter.rooms[client.chatId].sockets
            
            // console.log(clients)// all users from room

            // const sockets = Array.from(io.sockets.sockets).map(socket => socket[0]);
            // console.log(sockets);
            // console.log('SOCKET')
            // console.log(socket.rooms);
            // console.log(socket.clients);
            // console.log(socket);
            // console.log(socket[0]);
            // Object.keys(io.sockets.clients).length

            // var clients = io.sockets.adapter.clients(client.chatId);
            // console.log(clients);

            socket.broadcast.to(client.chatId).emit('message', `A Client has joined the chat room [${chatId}]`);
            
            socket.to(client.chatId).emit('chatConnected', `Chat Dispensary Connected Room: ${client}`);
        })

        socket.on("sendMessage", (message) => {

            const client = getCurrentRoom(socket.id)

            if (client !== undefined) {
                ChatController.chatSaveMessage(message.chatid, message.message);    
                socket.to(client.chatId).emit("receiveMessage", message.message)
            }
        })

        socket.on('markReadMessage', (message) => {

            if (message !== undefined) {
                ChatController.chatMarkReadMessage(message.chatId, message.kind);
            }
        })

        socket.on('leavePrivateChat', () => {

            const client = leaveRoom(socket.id);

            if (client !== undefined) {
                socket.leave(client.chatId);
                io.to(client.chatId).emit('message', `A Client has left the chat room [${client.chatId}]`);
            }
        })

        socket.on('disconnect', () => {

            const client = leaveRoom(socket.id);

            if (client !== undefined) {
                io.to(client.chatId).emit('message', `A Client has left the chat room [${client.chatId}]`);
            }
        })
    })
}

//
//Init AutoProcess
//
DealsAutoProcess.dealsAutoClosed();


