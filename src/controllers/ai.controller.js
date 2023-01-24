import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generatorAI = async (req, res) => {
  const text = req.body.text;
  const openai = new OpenAIApi(configuration);
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: text,
    max_tokens: 3000,
    temperature: 0.9,
  });
  console.log(response);
  res.status(200).json(response.data.choices[0].text);
};
