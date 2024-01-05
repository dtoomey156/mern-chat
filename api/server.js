const express = require("express");
const app = express();
require("dotenv").config();

const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URL);

// this db variable is only used to log out the connection success or failure
const db = mongoose.connection;

app.get("/test", (req, res) => {
    res.json("poopy");
});

app.post("/register", (req, res) => {});

// MongoDB via Mongoose connection confirmation

db.once("open", (_) => {
    console.log(`Database connected on ${process.env.MONGO_URL}`);
});

db.on("error", (err) => {
    console.error("Database connection error", err);
});

app.listen(process.env.SERVER_PORT, () => {
    console.log(`server listening on port ${process.env.SERVER_PORT}`);
});
