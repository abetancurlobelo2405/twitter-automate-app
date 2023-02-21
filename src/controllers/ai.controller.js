import jwt from "jsonwebtoken";
import { Configuration, OpenAIApi } from "openai";
import User from "../models/User.js";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generatorAI = async (req, res) => {
  const text = req.body.text;
  const token = req.body.token;
  const options = req.body.options;
  let userId;

  try {
    userId = jwt.verify(token, process.env.SECRET_TOKEN_KEY);
  } catch (error) {
    return res.status(401).end();
  }

  const openai = new OpenAIApi(configuration);
  try {
    const user = await User.findOne({ userId: userId });

    if (
      user.plan.adventages.tries > 0 ||
      user.plan.adventages.tries === "unlimited"
    ) {
      const response = await openai.createCompletion({
        model: "text-ada-001",
        prompt: `${text} in tweet-format
        min. of 200 characters, max. 280 character per tweet.
        adding relevant ${options.emojis ? "emojis" : ""}, 
        ${options.hashtags ? "hashtags" : ""}, 
        long and informative texts and elements to enhance readability and engagement.`,
        max_tokens: 1000,
        temperature: 0.9,
      });

      if (user.plan.adventages.tries !== "unlimited") {
        await User.updateOne(
          { userId: userId },
          { $inc: { "plan.adventages.tries": -1 } }
        );
      }
      res.status(200).json(response.data.choices[0].text);
    } else {
      res.status(405).json({ message: "Not enough tries to create tweets" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.response.data.error.message });
  }
};
