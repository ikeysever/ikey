const express = require("express");
const supabase = require("./config/supabase");
const healthRoutes = require("./routes/health");
const fingerprintRoutes = require("./routes/fingerprint");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/", healthRoutes);
app.use("/api", fingerprintRoutes);

app.get("/", (req, res) => {
  res.send("iKey Server");
});

app.listen(PORT, () => {
  console.log(`iKey Server running on port ${PORT}`);
});
