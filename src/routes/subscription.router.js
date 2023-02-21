import express from "express";
import {
  subscriptionUpdateHandler,
  subscriptionUpgradeHandler,
  webhookHandler,
} from "../controllers/subscription.controller.js";
const subscriptionRouter = express.Router();

subscriptionRouter.post("/webhooks", webhookHandler);
subscriptionRouter.post("/pause", subscriptionUpdateHandler);
subscriptionRouter.post("/upgrade", subscriptionUpgradeHandler);

export { subscriptionRouter };
