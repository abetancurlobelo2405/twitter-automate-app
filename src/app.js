import express from "express";
import { twitterLoginRouter } from "./routes/twitter.router.js";
import { generatorAIRouter } from "./routes/ai.router.js";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import session from "express-session";
import verifyToken from "./middleware/auth.js";

dotenv.config();

const PORT = 8080 || process.env.PORT;
const app = express();

app.use(
  cors({
    origin: "http://127.0.0.1:3000",
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

/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 */

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
