var express = require('express');
var app = express();
// Just a simple server for static files
app.use(express.static("."))
let port = process.env.PORT || 3000
app.listen(port, () => console.log(`Fractal Sky server listening on port ${port}`));
