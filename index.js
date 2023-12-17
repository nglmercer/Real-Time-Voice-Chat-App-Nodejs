const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const port = 4001;

const public = path.join(__dirname, "./public");
app.use(express.static(public));

app.set('view engine', 'hbs');

app.get('/', (req, res) => {
    res.render("index");
});

const onlineUsers = {};

// Socket.IO logic
io.on('connection', (socket) => {
    socket.on("joinedusername", (username) => {
        onlineUsers[socket.id] = username;
        
        io.emit("allonlineusers", Object.values(onlineUsers));
    });

    socket.on("audio", (data) => {
        socket.broadcast.emit("audio1", data);
    });

    socket.on('disconnect', () => {
        const username = onlineUsers[socket.id];

        if (username) {
            delete onlineUsers[socket.id];

            io.emit("allonlineusers", Object.values(onlineUsers));
        }
    });
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
