import "dotenv/config";
import express from "express";
import cors from "cors";
import { adaptRouter } from "./routes/adapt";
import { ocrRouter } from "./routes/ocr";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.use("/api/adapt", adaptRouter);
app.use("/api/ocr", ocrRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "adapted-bff" });
});

app.listen(PORT, () => {
  console.log(`AdaptEd BFF running on http://localhost:${PORT}`);
});
