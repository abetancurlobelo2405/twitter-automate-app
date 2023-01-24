import express from "express";
import { twitterLoginRouter } from "./routes/twitter.router.js";
import { generatorAIRouter } from "./routes/ai.router.js";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import cron from "node-cron";
import verifyToken from "./middleware/auth.js";

dotenv.config();

const PORT = process.env.PORT || 8080;
const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/", verifyToken, (req, res) => {
  res.send(200);
});

app.use("/twitter/login", twitterLoginRouter);
app.use("/twitter/generate", generatorAIRouter);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
