import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "adapted-bff" });
});

app.listen(PORT, () => {
  console.log(`AdaptEd BFF running on http://localhost:${PORT}`);
});
