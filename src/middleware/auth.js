import jwt from "jsonwebtoken";

const verifyToken = (req, res, next) => {
  console.log(req.headers["authorization"]);
  const token = req.headers["authorization"];

  if (token === "undefined") {
    console.log("Redigir usuario a login page");
    return res.status(403).send("A token is required for authentication");
  }
  try {
    const decoded = jwt.verify(token, process.env.SECRET_TOKEN_KEY);
    console.log(decoded);
  } catch (err) {
    console.log("Invalid token...");
    console.log("Remover la actual cookie y redirigir al usuario");
    return res.status(401).send("Invalid Token");
  }
  return next();
};

export default verifyToken;
