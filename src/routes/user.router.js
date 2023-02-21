import express from "express";
import { userData } from "../controllers/user.controller.js";
const userRouter = express.Router();

userRouter.post("/", userData);

export { userRouter };
