// Just a simple server for static files
require("dotenv").config();
let express = require('express');
let fs = require("fs");
let log   = console.log;
let debug = console.log;
let error = console.error;

try {
  fs.writeFileSync("config.json",
                   JSON.stringify({BACKEND: process.env.BACKEND}))}
catch (err) {error(err)}

let app = express();
app.use(express.static("."));
let port = process.env.PORT || 80
app.listen(port, () => log(`Fractal Sky frontend listening on port ${port}`));

