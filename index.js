const fs = require('fs');
const https = require('https');
const socketIO = require("socket.io");
const path = require("path");
const express = require("express");

const app = express();

// Leer certificados SSL
const privateKey = fs.readFileSync('key.pem', 'utf8');
const certificate = fs.readFileSync('cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const httpsServer = https.createServer(credentials, app);
const io = socketIO(httpsServer);

const port = 4001;

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

httpsServer.listen(port, () => {
    console.log(`Server is running on https://localhost:${port}`);
});
