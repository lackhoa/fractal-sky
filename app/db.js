require('dotenv').config()
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DB_CONN + "?sslmode=require",
  ssl: {rejectUnauthorized: false}});

client.connect();

client.query("SELECT * FROM users;",
             (err, res) => {
               if (err) {throw err}
               else {
                 for (let row of res.rows) {
                   console.log(JSON.stringify(row));}
                 console.log("We got in!"); client.end();}});
