const express = require("express");
const app = express();

app.get("/test", (req, res) => {
  res.json("poopy");
});

app.post("/register", (req, res) => {});

app.listen(4040, () => {
  console.log("server listening on 4040");
});
