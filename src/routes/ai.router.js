import express from "express";
import { generatorAI } from "../controllers/ai.controller.js";

const generatorAIRouter = express.Router();

generatorAIRouter.post("/", generatorAI);

export { generatorAIRouter };
