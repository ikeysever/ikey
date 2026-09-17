const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("iKey Server");
});

app.get("/ping", (req, res) => {
  res.json({
    status: "ok",
    service: "iKey",
    message: "iKey Server OK"
  });
});

app.listen(PORT, () => {
  console.log(`iKey Server running on port ${PORT}`);
});
