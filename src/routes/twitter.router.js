import express from "express";
import {
  callback,
  startAuth,
  postSingleTweet,
  postThreadTweet,
} from "../controllers/twitter.controller.js";
const twitterLoginRouter = express.Router();

twitterLoginRouter.get("/start-auth", startAuth);
twitterLoginRouter.post("/callback", callback);
twitterLoginRouter.post("/post-tweet", postSingleTweet);
twitterLoginRouter.post("/post-thread", postThreadTweet);

export { twitterLoginRouter };
