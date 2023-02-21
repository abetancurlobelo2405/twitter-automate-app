import { model, Schema } from "mongoose";
import bcryptjs from "bcryptjs";

const UserSchema = new Schema({
  userId: { type: String },
  screenName: String,
  oauthToken: { type: String },
  oauthTokenSecret: { type: String },
  scheduleTweets: [{ type: Object }],
  plan: {
    isSubscribed: { type: Boolean },
    adventages: { type: Object },
    subscriptionDetails: { type: Object },
  },
});

const User = model("User", UserSchema);
export default User;
