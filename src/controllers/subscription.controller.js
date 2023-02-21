import jwt from "jsonwebtoken";
import User from "../models/User.js";
import axios from "axios";
import dotenv from "dotenv";
import { connectDB } from "../lib/mongoDBconnect.js";
import { verifyPaddleWebhook } from "verify-paddle-webhook";
dotenv.config();
connectDB();

const PUBLIC_PADDLE_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA1w3XusbO+6+ET7s2a/fY
it8wNYBf5D9c/5gbwOwGyeDVoyMdJ8W66FOfL3ycnJeSjgTzuCVfjlSEz0SRmxos
J0kLLtcBM3DmBzSUybJbmQ/9tsVAuKOwQ44P0jqq1EkMXF5tjrBq/FvnGI+RInYE
KLesqrTns5uB37ZqdBok/XPLeFvklRs5mLmN9XctyYm/9n230iFByDmvCdfYzgyS
ZId7H4QAuzLomBO3iumvZHSBpquzTaJkmpjKpQnBe3TbjHh9Vxe9FXp564l7dp5i
v/n/aql5KzJrCY31CtAwItUtk/tZL2B4TYGKk9cn/NoN06GPLDGD3caMPaTJ8VvR
Z28/PBraNLnsy1FaakoRkSSVL18/o8+A6DCJelEafLdCkCPoonM7jQ1TxwFxhxQn
H2GsZr+ai6DlDIzWFdCyuvUl1zXYl1mDc8JV61tJcaCnakzKKTtkO4gTF5qsub47
9NUiYtxCuSDzSF3GqIiaqZE0mSSIUr6GrjAJGLsTyahxG7N1VihbNibUtV6cik8F
wOn0Oh9E36jrFEE2d7EePjJhVww9nF+w+VHsBNdTgEAOQXeRHthK8a8a+nVSShX2
JyDgAM53BHp8hPw8+o34NJWqgTijLoYX5iQzLTxv2tkcgh4OwalMrRYCqYH8Z9C6
ulzV9VJxxjx20h2x6I0ZT4kCAwEAAQ==
-----END PUBLIC KEY-----`;

function webhookVerifier(paddleWebhookData) {
  return verifyPaddleWebhook(PUBLIC_PADDLE_KEY, paddleWebhookData);
}

const PLANS = {
  intermediumPlan: "43799",
  premiumPlan: "43877",
};

export const webhookHandler = async (req, res) => {
  const token = JSON.parse(req?.body?.custom_data);

  const data = req.body;
  const isValidWebhook = webhookVerifier(data);
  if (token && isValidWebhook) {
    try {
      const userToken = jwt.verify(
        token["currentUserToken"],
        process.env.SECRET_TOKEN_KEY
      );
      const user = await User.findOne({ userId: userToken });
      if (data.alert_name === "subscription_payment_succeeded") {
        const userAdventages = () => {
          if (data.subscription_plan_id === PLANS.intermediumPlan) {
            return {
              tries: user.plan.isSubscribed ? 0 : 10,
              schedules: user.plan.isSubscribed ? 0 : 5,
            };
          }

          if (data.subscription_plan_id === PLANS.premiumPlan) {
            console.log("premium kekw");
            return { tries: "unlimited", schedules: 8 };
          }
        };

        try {
          await User.updateOne(
            { userId: userToken },
            {
              $set: {
                "plan.isSubscribed": true,
                "plan.adventages": userAdventages(),
                "plan.subscriptionDetails": {
                  subscriptionStatus: data.status,
                  subscriptionID: data.subscription_id,
                  subscriptionPlanID: data.subscription_plan_id,
                  startDate: data.event_time,
                  nextBillingDate: data.next_bill_date,
                  userID: data.user_id,
                  currentStatus: "activated",
                  pausedAt: data.paused_at ? data.paused_at : null,
                  pausedFrom: data.paused_from ? data.paused_from : null,
                },
              },
            }
          );
          res.status(200).end();
        } catch (error) {
          console.log(error);
        }
      }

      if (data.alert_name === "subscription_updated") {
        try {
          await User.updateOne(
            { userId: userToken },
            {
              $set: {
                "plan.isSubscribed": true,
                "plan.subscriptionDetails": {
                  subscriptionStatus: data.status,
                  subscriptionID: data.subscription_id,
                  subscriptionPlanID: data.subscription_plan_id,
                  startDate: data.event_time,
                  nextBillingDate: data.next_bill_date,
                  userID: data.user_id,
                  currentStatus:
                    data.paused_at && data.paused_from ? "paused" : "activated",
                  pausedAt: data.paused_at ? data.paused_at : null,
                  pausedFrom: data.paused_from ? data.paused_from : null,
                },
              },
            }
          );
          res.status(200).end();
        } catch (error) {
          console.log(error);
        }
      }
    } catch (error) {
      console.log("err: ", error);
    }
  }
};

export const subscriptionUpgradeHandler = async (req, res) => {
  const token = req.body.token;
  const userToken = jwt.verify(token, process.env.SECRET_TOKEN_KEY);
  const user = await User.findOne({ userId: userToken });

  const options = {
    method: "POST",
    url: "https://sandbox-vendors.paddle.com/api/2.0/subscription/users/update",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: {
      vendor_id: "10371",
      vendor_auth_code: "4aa5d4d661b166f5ff6d9289ce89ab3aff24f08582f8802f99",
      subscription_id: `${user.plan.subscriptionDetails.subscriptionID}`,
      plan_id: Number(req.body.planId),
      bill_immediately: true,
      prorate: true,
    },
  };

  try {
    axios.request(options).then(function (response) {
      res.status(200).json(response.data);
    });
  } catch (error) {
    console.log(error);
  }
};

export const subscriptionUpdateHandler = async (req, res) => {
  const token = req.body.token;
  const userToken = jwt.verify(token, process.env.SECRET_TOKEN_KEY);
  const user = await User.findOne({ userId: userToken });

  if (req.body.pause || !req.body.pause) {
    const options = {
      method: "POST",
      url: "https://sandbox-vendors.paddle.com/api/2.0/subscription/users/update",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: {
        vendor_id: "10371",
        vendor_auth_code: "4aa5d4d661b166f5ff6d9289ce89ab3aff24f08582f8802f99",
        subscription_id: `${user.plan.subscriptionDetails.subscriptionID}`,
        pause: req.body.pause,
      },
    };

    axios
      .request(options)
      .then(function (response) {
        res.status(200).json(response.data);
      })
      .catch(function (error) {
        console.error(error);
      });
  }
};
