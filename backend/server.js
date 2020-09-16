require("dotenv").config();
let express = require("express");
let cors = require("cors");

let app = express();
app.use(express.json());
app.use(cors());

let CLIENT_ID = "48375711322-q0mmu1s3vtk4s5ca26fi2o8jjsnmvvna.apps.googleusercontent.com";
let {OAuth2Client} = require("google-auth-library");
let client = new OAuth2Client(CLIENT_ID);

async function verify (token) {
  // #todo What if this failed???
  let ticket = await client.verifyIdToken({idToken: token,
                                           audience: CLIENT_ID});
  let payload = ticket.getPayload();
  return payload;}

app.post("/token-signin", async function (req, res) {
  let token = req.body.token;
  let payload = await verify(token).catch(console.error);
  res.send(payload.sub);})

let port = process.env.PORT || 80
app.listen(port, () => console.log(`Fractal Sky backend server listening on port ${port}`));
