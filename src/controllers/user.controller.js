import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";
dotenv.config();

export const userData = async (req, res) => {
  const token = req.body.token;
  if (token) {
    const userToken = jwt.verify(token, process.env.SECRET_TOKEN_KEY);
    const user = await User.findOne({ userId: userToken });
    res.status(200).json(user);
  } else {
    res.status(401).end();
  }
};
