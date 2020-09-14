let express = require('express');

let app = express();

// Just a simple server for static files
let port = process.env.PORT || 80
app.listen(port, () => console.log(`Fractal Sky server listening on port ${port}`));

