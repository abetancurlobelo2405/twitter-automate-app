import OAuth from "oauth-1.0a";
import crypto from "crypto";
import got from "got";
import qs from "querystring";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";
import { connectDB } from "../lib/mongoDBconnect.js";
import moment from "moment-timezone";
import axios from "axios";
import cron from "node-cron";
dotenv.config();
connectDB();

const consumerKey = process.env.API_KEY;
const consumerSecret = process.env.API_SECRET;
const requestTokenURL = `https://api.twitter.com/oauth/request_token?oauth_callback=${process.env.CALLBACK_URL}`;
const accessTokenURL = "https://api.twitter.com/oauth/access_token";

const oauth = OAuth({
  consumer: {
    key: consumerKey,
    secret: consumerSecret,
  },
  signature_method: "HMAC-SHA1",
  hash_function: (baseString, key) =>
    crypto.createHmac("sha1", key).update(baseString).digest("base64"),
});

export const startAuth = async (req, res) => {
  try {
    async function requestToken() {
      const authHeader = oauth.toHeader(
        oauth.authorize({
          url: requestTokenURL,
          method: "POST",
        })
      );

      const req = await got.post(requestTokenURL, {
        headers: {
          Authorization: authHeader["Authorization"],
        },
      });
      if (req.body) {
        return qs.parse(req.body);
      } else {
        throw new Error("Cannot get an OAuth request token");
      }
    }
    const getOauthToken = await requestToken();
    const { oauth_token } = getOauthToken;

    async function authorize() {
      const authorizeURLwindow = `https://api.twitter.com/oauth/authorize?oauth_token=${oauth_token}`;
      res.json({ redirectUrl: authorizeURLwindow });
    }
    await authorize();
  } catch (error) {
    // retornamos un response con algun error
    console.log("error", error);
  }
};

export const callback = async (req, res) => {
  const oauthVerifier = req.body.oauthVerifier;
  const oauthToken = req.body.oauthToken;
  console.log(oauthVerifier, oauthToken);
  try {
    async function getAccessToken() {
      const authHeader = oauth.toHeader(
        oauth.authorize({
          url: accessTokenURL,
          method: "POST",
        })
      );

      const path = `${accessTokenURL}?oauth_verifier=${oauthVerifier}&oauth_token=${oauthToken}`;
      const request = await axios.post(path, {
        headers: {
          Authorization: authHeader["Authorization"],
        },
      });
      if (request.data) {
        return request.data;
      } else {
        throw new Error("Cannot get an OAuth request token");
      }
    }
    const accessTokens = await getAccessToken();

    const dataObject = {};
    const dataSplit = accessTokens.split("&");
    dataSplit.map((elements) => {
      let keyValue = elements.split("=");
      dataObject[keyValue[0]] = keyValue[1];
    });
    const token = jwt.sign(dataObject.user_id, process.env.SECRET_TOKEN_KEY);

    const findUser = await User.find({ userId: dataObject.user_id });

    // Checks if user exists, if length 0, means not, so it creates one in "else" condition.
    if (findUser.length === 0) {
      const newUser = await new User({
        userId: dataObject.user_id,
        screenName: dataObject.screen_name,
        oauthToken: dataObject.oauth_token,
        oauthTokenSecret: dataObject.oauth_token_secret,
        plan: {
          isSubscribed: false,
          adventages: { tries: 2, schedules: 1 },
        },
      });
      await newUser.save();
      console.log(dataObject);
      res
        .status(200)
        .json({ token: token, screenName: dataObject.screen_name });
    } else {
      console.log("Encontro el usuario");
      res
        .status(200)
        .json({ token: token, screenName: dataObject.screen_name });
    }
  } catch (error) {
    console.log("error", error);
  }
};

export const postSingleTweet = async (req, res) => {
  const createTweet = `https://api.twitter.com/2/tweets`;
  const token = req.headers["authorization"];
  const headerText = req.body.headerText;
  const result = req.body.result;
  const isSchedule = req.body.isSchedule;
  const dateValues = req.body.dateValues;

  const date = new Date();
  date.setDate(date.getDate() + Number(dateValues.days));
  date.setHours(date.getHours() + Number(dateValues.hours));
  date.setMinutes(date.getMinutes() + Number(dateValues.minutes));

  console.log(`Minutes: ${date.getUTCMinutes()}`);
  console.log(`Hours: ${date.getUTCHours()}`);
  console.log(`Current day: ${date.getUTCDate()}`);

  const cronExpression = `
    ${Number(date.getUTCMinutes())}
    ${Number(date.getUTCHours())}
    ${Number(date.getUTCDate())}
    ${date.getUTCMonth() + 1}
    ${date.getUTCDay()}
  `;

  console.log(cronExpression);
  const data = {
    text: headerText ? `${headerText}\n${result}` : result,
  };

  try {
    const id = jwt.verify(token, process.env.SECRET_TOKEN_KEY);
    const user = await User.findOne({ userId: id });
    const tweet = async (oauth_token, oauth_token_secret) => {
      const token = {
        key: oauth_token,
        secret: oauth_token_secret,
      };

      const authHeader = oauth.toHeader(
        oauth.authorize(
          {
            url: createTweet,
            method: "POST",
          },
          token
        )
      );

      const fetchTwitterAPI = async () => {
        try {
          await axios.post(createTweet, data, {
            headers: {
              Authorization: authHeader["Authorization"],
            },
          });
        } catch (error) {
          if (error.response.status === 403) {
            res.status(403).json({ message: "Duplicated content" });
          }

          if (error.response.status === 400 || error.response.status === 401) {
            res.status(403).json({ message: "error" });
          }
        }
      };

      if (isSchedule) {
        const job = cron.schedule(
          cronExpression,
          async () => {
            await fetchTwitterAPI();
            console.log("published!");
            const userUpdated = await User.updateOne(
              { userId: id },
              { $pull: { scheduleTweets: { cronId: job.options.name } } }
            );
            console.log(userUpdated);
            job.stop();
          },
          {
            timezone: "UTC",
          }
        );
        user.scheduleTweets = user.scheduleTweets.concat({
          cronId: job.options.name,
          result,
          date,
        });
        await user.save();
      } else {
        console.log("NO-escheudelado");
        await fetchTwitterAPI();
      }
    };

    await tweet(user.oauthToken, user.oauthTokenSecret);
  } catch (error) {
    console.log("error", error);
  }
};

export const postThreadTweet = async (req, res) => {
  const createTweet = `https://api.twitter.com/2/tweets`;
  const token = req.headers["authorization"];
  const headerText = req.body.headerText;
  const result = req.body.result;
  const dateValues = req.body.dateValues;
  const isSchedule = req.body.isSchedule;

  const date = new Date();
  date.setDate(date.getDate() + Number(dateValues.days));
  date.setHours(date.getHours() + Number(dateValues.hours));
  date.setMinutes(date.getMinutes() + Number(dateValues.minutes));

  console.log(`Minutes: ${date.getUTCMinutes()}`);
  console.log(`Hours: ${date.getUTCHours()}`);
  console.log(`Current day: ${date.getUTCDate()}`);

  const cronExpression = `
  ${Number(date.getUTCMinutes())}
  ${Number(date.getUTCHours())}
  ${Number(date.getUTCDate())}
  ${date.getUTCMonth() + 1}
  ${date.getUTCDay()}
`;

  console.log(cronExpression);

  const id = jwt.verify(token, process.env.SECRET_TOKEN_KEY);
  const user = await User.findOne({ userId: id });

  const oauthToken = user.oauthToken;
  const oauthTokenSecret = user.oauthTokenSecret;
  try {
    const tweetThreadPost = async () => {
      const principalTweet = async () => {
        const principalTweet = {
          text: headerText !== undefined ? headerText : result[0],
        };

        const token = {
          key: oauthToken,
          secret: oauthTokenSecret,
        };
        const authHeader = oauth.toHeader(
          oauth.authorize(
            {
              url: createTweet,
              method: "POST",
            },
            token
          )
        );
        try {
          const response = await axios.post(createTweet, principalTweet, {
            headers: {
              Authorization: authHeader["Authorization"],
            },
          });
          return { id: response.data.data.id, text: response.data.data.text };
        } catch (error) {
          if (error.response.status === 403) {
            res.status(403).json({ message: "Duplicated content" });
          }

          if (error.response.status === 400 || error.response.status === 401) {
            res.status(403).json({ message: "error" });
          }
        }
      };
      await principalTweet().then(async (firstData) => {
        const dataArray = headerText !== undefined ? result : result.slice(1);
        let currentTweetID = firstData.id;

        for (let i = 0; i < dataArray.length; i++) {
          const tweet = dataArray[i];
          console.log(i);
          const token = {
            key: oauthToken,
            secret: oauthTokenSecret,
          };

          let threadTweet = {
            text: tweet,
            reply: { in_reply_to_tweet_id: currentTweetID },
          };

          const authHeader = oauth.toHeader(
            oauth.authorize(
              {
                url: createTweet,
                method: "POST",
              },
              token
            )
          );
          try {
            const response = await axios.post(createTweet, threadTweet, {
              headers: {
                Authorization: authHeader["Authorization"],
              },
            });
            currentTweetID = response.data.data.id;
          } catch (error) {
            if (error.response.status === 403) {
              res.status(403).json({ message: "Duplicated content" });
            }

            if (
              error.response.status === 400 ||
              error.response.status === 401
            ) {
              res.status(403).json({ message: "error" });
            }
          }
        }
      });
    };

    if (isSchedule) {
      console.log("escheudelado thread");
      const job = cron.schedule(
        cronExpression,
        async () => {
          await tweetThreadPost();
          console.log("published!");
          await User.updateOne(
            { userId: id },
            { $pull: { scheduleTweets: { cronId: job.options.name } } }
          );
          job.stop();
        },
        {
          timezone: "UTC",
        }
      );
      user.scheduleTweets = user.scheduleTweets.concat({
        cronId: job.options.name,
        result,
        date,
      });
      await user.save();
    } else {
      console.log("NO-escheudelado thread");
      await tweetThreadPost();
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.log(error);
  }
};
