const fs = require('fs');
const https = require('https');
const http = require('http');
const socketIO = require("socket.io");
const path = require("path");
const express = require("express");

const app = express();
const port = 4001;

let server;
let io;

// Intenta leer los certificados SSL
let privateKey, certificate, credentials;

try {
    privateKey = fs.readFileSync('key.pem', 'utf8');
    certificate = fs.readFileSync('cert.pem', 'utf8');
    credentials = { key: privateKey, cert: certificate };

    // Si las credenciales existen, inicia el servidor en HTTPS
    server = https.createServer(credentials, app);
    io = socketIO(server);
    console.log("SSL credentials found. Starting HTTPS server...");
} catch (error) {
    console.log("SSL credentials not found. Starting HTTP server...");
    
    // Si no hay credenciales, inicia el servidor en HTTP
    server = http.createServer(app);
    io = socketIO(server);
}

const publicDir = path.join(__dirname, "./public");
app.use(express.static(publicDir));

app.set('view engine', 'hbs');

app.get('/', (req, res) => {
    res.render("index");
});

const onlineUsers = {};

io.on('connection', (socket) => {
    socket.on("joinedusername", (username) => {
        console.log("joinedusername", username);
        onlineUsers[socket.id] = username;
        io.emit("allonlineusers", Object.values(onlineUsers));
        io.emit("user-connected", username);
    });
    socket.on('ready', (username) => {
        socket.broadcast.emit('ready', socket.id);
    });

    socket.on('offer', ({ offer, to }) => {
        io.to(to).emit('offer', { offer, from: socket.id });
    });

    socket.on('answer', ({ answer, to }) => {
        io.to(to).emit('answer', { answer, from: socket.id });
    });

    socket.on('ice-candidate', ({ candidate, to }) => {
        io.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

    socket.on('disconnect', () => {
        const username = onlineUsers[socket.id];
        if (username) {
            delete onlineUsers[socket.id];
            io.emit("allonlineusers", Object.values(onlineUsers));
            io.emit("user-disconnected", username);
        }
    });
});

server.listen(port, () => {
    console.log(`Server is running on ${credentials ? 'https' : 'http'}://localhost:${port}`);
});
