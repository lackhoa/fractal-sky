require("dotenv").config();
let express = require("express");
let cors = require("cors");

let app = express();
app.use(express.json());
app.use(cors());

let log   = console.log;
let debug = console.log;
let error = console.error
let CLIENT_ID = "48375711322-q0mmu1s3vtk4s5ca26fi2o8jjsnmvvna.apps.googleusercontent.com";
let {OAuth2Client} = require("google-auth-library");
let client = new OAuth2Client(CLIENT_ID);

app.post("/token-signin", async (req, res) => {
  let token = req.body.token;
  client.verifyIdToken({idToken: token,
                        audience: CLIENT_ID})
    .catch(error)
    .then(ticket => ticket.getPayload())
    .then(payload => res.send(payload.sub));})

let port = process.env.PORT || 80
app.listen(port, ()=>log(`Fractal Sky backend listening on port ${port}`));
