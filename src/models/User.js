import { model, Schema } from "mongoose";
import bcryptjs from "bcryptjs";

const UserSchema = new Schema({
  userId: { type: String },
  screenName: { type: String },
  oauthToken: { type: String },
  oauthTokenSecret: { type: String },
});

const User = model("User", UserSchema);
export default User;
