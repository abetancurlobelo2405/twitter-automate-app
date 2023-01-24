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
const callbackUrl =
  "oauth_callback=https%3A%2F%2Fmain--effulgent-cuchufli-c1d7d6.netlify.app%2Fauth-page";
const requestTokenURL = `https://api.twitter.com/oauth/request_token?${callbackUrl}`;
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

  try {
    async function getAccessToken() {
      const authHeader = oauth.toHeader(
        oauth.authorize({
          url: accessTokenURL,
          method: "POST",
        })
      );
      const path = `${accessTokenURL}?oauth_verifier=${oauthVerifier}&oauth_token=${oauthToken}`;
      const request = await got.post(path, {
        headers: {
          Authorization: authHeader["Authorization"],
        },
      });
      if (request.body) {
        return request.body;
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
    const newUser = await new User({
      userId: dataObject.user_id,
      oauthToken: dataObject.oauth_token,
      oauthTokenSecret: dataObject.oauth_token_secret,
      screenName: dataObject.screen_name,
    });
    const token = jwt.sign(dataObject.user_id, process.env.SECRET_TOKEN_KEY);
    await newUser.save();
    res.json(token);
  } catch (error) {
    console.log("error", error);
  }
};

export const postSingleTweet = async (req, res) => {
  const createTweet = `https://api.twitter.com/2/tweets`;
  const token = req.headers["authorization"];
  const headerText = req.body.headerText;
  const result = req.body.result;

  const dateValues = req.body.dateValues;
  console.log(dateValues);
  const date = new Date();
  const cronExpression = `
    ${Number(date.getMinutes() + Number(dateValues.minutes))}
    ${Number(date.getHours() + Number(dateValues.hours))}
    ${Number(date.getDate() + Number(dateValues.days))}
    ${date.getMonth() + 1}
    ${date.getDay()}
  `;

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
        return await fetch(
          createTweet,
          {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
              Authorization: authHeader["Authorization"],
              "Content-Type": "application/json",
              accept: "application/json",
            },
          },
          {
            timezone: "UTC",
          }
        );
      };

      if (
        dateValues.days === 0 &&
        dateValues.hours === 0 &&
        dateValues.minutes === 0
      ) {
        console.log("NO-escheudelado");
        await fetchTwitterAPI();
      } else {
        console.log("escheudelado");
        const job = cron.schedule(cronExpression, async () => {
          await fetchTwitterAPI();
          console.log("published!");
          job.stop();
        });
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
  const data = req.body.result;

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
          text: headerText !== undefined ? headerText : data[0],
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
              "content-type": "application/json",
              accept: "application/json",
            },
          });
          return { id: response.data.id, text: response.data.text };
        } catch (error) {
          console.log("error", error);
        }
      };
      await principalTweet().then(async (firstData) => {
        const dataArray = headerText !== undefined ? data : data.slice(1);
        let currentTweetID = firstData.id;

        for (let i = 0; i < dataArray.length; i++) {
          const tweet = dataArray[i];
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
              Authorization: authHeader["Authorization"],
              "content-type": "application/json",
              accept: "application/json",
            });
            console.log(response);
            currentTweetID = response.data.id;
          } catch (error) {
            console.log("error");
          }
        }
      });
    };

    if (
      (isSchedule && dateValues.days > 0) ||
      dateValues.hours > 0 ||
      dateValues.minutes > 0
    ) {
      console.log("escheudelado thread");
      const job = cron.schedule(
        cronExpression,
        async () => {
          await tweetThreadPost();
          console.log("published!");
          job.stop();
        },
        {
          timezone: "UTC",
        }
      );
    } else {
      console.log("NO-escheudelado thread");
      await tweetThreadPost();
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.log(error);
  }
};
