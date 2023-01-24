import express from "express";
import verifyToken from "../middleware/auth.js";
import {
  callback,
  startAuth,
  postSingleTweet,
  postThreadTweet,
} from "../controllers/twitter.controller.js";
const twitterLoginRouter = express.Router();

twitterLoginRouter.get("/start-auth", startAuth);
twitterLoginRouter.post("/callback", callback);
twitterLoginRouter.post("/post-tweet", verifyToken, postSingleTweet);
twitterLoginRouter.post("/post-thread", verifyToken, postThreadTweet);

export { twitterLoginRouter };
