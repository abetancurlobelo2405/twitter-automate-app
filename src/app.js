import express from "express";
import { twitterLoginRouter } from "./routes/twitter.router.js";
import { generatorAIRouter } from "./routes/ai.router.js";
import { subscriptionRouter } from "./routes/subscription.router.js";
import { userRouter } from "./routes/user.router.js";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import User from "./models/User.js";

dotenv.config();

const PORT = process.env.PORT || 8080;
const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

const PLANS = {
  intermediumPlan: "43799",
  premiumPlan: "43877",
};

cron.schedule("* */24 * * *", async () => {
  await User.updateMany(
    { "plan.subscriptionDetails.subscriptionPlanID": PLANS.intermediumPlan },
    { $set: { "plan.adventages.tries": 10 } }
  );

  await User.updateMany(
    { "plan.isSubscribed": false },
    { $set: { "plan.adventages.tries": 2 } }
  );
});

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use("/twitter/login", twitterLoginRouter);
app.use("/subscription", subscriptionRouter);
app.use("/twitter/generate", generatorAIRouter);
app.use("/user-data", userRouter);

app.listen(PORT, () => {
  console.log(`Running at port ${PORT}`);
});
