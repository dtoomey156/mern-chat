const express = require("express");
const app = express();
const User = require("./models/User");
const Message = require("./models/Message");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URL);
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);
const ws = require("ws");

// this db variable is only used to log out the connection success or failure
const db = mongoose.connection;

app.use(
    cors({
        credentials: true,
        origin: process.env.CLIENT_URL,
    })
);

app.use(express.json());

app.use(cookieParser());

async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token;
        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) throw err;
                resolve(userData);
            });
        } else {
            reject("no token");
        }
    });
}

app.get("/test", (req, res) => {
    res.json("poopy");
});

app.get("/messages/:userId", async (req, res) => {
    // const { userId } = req.params;
    const { userId } = req.params;
    const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.userId;
    const messages = await Message.find({
        sender: { $in: [userId, ourUserId] },
        recipient: { $in: [userId, ourUserId] },
    }).sort({ createdAt: 1 });
    res.json(messages);
});

app.get("/", (req, res) => {
    res.json("helooooooooo");
});

app.get("/profile", (req, res) => {
    const token = req.cookies?.token;
    if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if (err) throw err;
            res.json(userData);
        });
    } else {
        res.status(201);
    }
});

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({
        username: username,
        password: hashedPassword,
    });
    jwt.sign(
        { userId: createdUser._id, username },
        jwtSecret,
        {},
        (err, token) => {
            if (err) throw err;
            res.cookie("token", token, { sameSite: "none", secure: true })
                .status(201)
                .json({
                    id: createdUser._id,
                });
        }
    );
});

app.post("/login", async (req, res) => {
    const { password, username } = req.body;
    const foundUser = await User.findOne({ username });
    if (foundUser) {
        const passOk = bcrypt.compareSync(password, foundUser.password);
        if (passOk) {
            jwt.sign(
                { userId: foundUser._id, username },
                jwtSecret,
                {},
                (err, token) => {
                    res.cookie("token", token, {
                        sameSite: "none",
                        secure: true,
                    }).json({
                        id: foundUser._id,
                    });
                }
            );
        }
    }
});

// MongoDB via Mongoose connection confirmation

db.once("open", (_) => {
    console.log(`Database connected on ${process.env.MONGO_URL}`);
});

db.on("error", (err) => {
    console.error("Database connection error", err);
});

const server = app.listen(process.env.SERVER_PORT, () => {
    console.log(`server listening on port ${process.env.SERVER_PORT}`);
});

// set up the websocket server and read unsername and id from the cookie

const wss = new ws.WebSocketServer({ server });
wss.on("connection", (connection, req) => {
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookieString = cookies
            .split(";")
            .find((str) => str.startsWith("token="));
        if (tokenCookieString) {
            const token = tokenCookieString.split("=")[1];
            if (token) {
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if (err) throw err;
                    const { userId, username } = userData;
                    connection.userId = userId;
                    connection.username = username;
                });
            }
        }
    }

    connection.on("message", async (message) => {
        const messageData = JSON.parse(message.toString());
        console.log(
            "message data sent through server from send Message",
            messageData
        );
        const { recipient, text } = messageData;
        if (recipient && text) {
            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient,
                text,
            });
            [...wss.clients]
                .filter((c) => c.userId === recipient)
                .forEach((c) =>
                    c.send(
                        JSON.stringify({
                            text,
                            sender: connection.userId,
                            recipient,
                            _id: messageDoc._id,
                        })
                    )
                );
        }
    });

    // notifies everyone about online people when someone connects

    [...wss.clients].forEach((client) => {
        client.send(
            JSON.stringify({
                online: [...wss.clients].map((client) => ({
                    userId: client.userId,
                    username: client.username,
                })),
            })
        );
    });
});
