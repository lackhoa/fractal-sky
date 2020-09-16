// Just a simple server for static files
require("dotenv").config();
let express = require('express');
let fs = require("fs");

try {
  fs.writeFileSync("config.json",
                   JSON.stringify({BACKEND: process.env.BACKEND}))}
catch (err) {console.error(err)}

let app = express();
app.use(express.static("."));
let port = process.env.PORT || 80
app.listen(port, () => console.log(`Fractal Sky frontend server listening on port ${port}`));

