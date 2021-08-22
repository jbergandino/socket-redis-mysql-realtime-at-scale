const express = require('express');
const app     = express();
const port    = 5000;
const http    = require("http");
const server  = app.listen(port, () => {
    console.log('Listening on port: ' + port);
});
const io = require('socket.io')(server, {
    cors: {
        origin: 'http://localhost:' + port,
        methods: ['GET', 'POST'],
        transports: ['websocket', 'polling'],
        credentials: true
    },
    allowEIO3: true
});

const redis    = require("redis");
const client   = redis.createClient();
const nodeCron = require("node-cron");
const mysql    = require('mysql');
require('dotenv').config()

app.set("view engine", "ejs");

// gathers all existing redis messages (could limit this to last N messages or w/e)
function fetchMessages(socket) {
    client.lrange("messages", "0", "-1", (err, data) => {
        data.map(x => {
            const usernameMessage = x.split(":");
            const timestamp     = usernameMessage[0];
            const redisUsername = usernameMessage[1];
            const redisMessage  = usernameMessage[2];
            socket.emit("message", {
                timestamp: timestamp,
                from: redisUsername,
                message: redisMessage
            });
        });
    });
}

// notifies chat room when someone joins
app.get("/chat", (req, res) => {
    const username = req.query.username;
    io.emit("joined", username);
    res.render("chat", { username });
});

app.get("/", (req, res) => {
    res.render("index");
});

// If we ever want to wait to start cronjob, make scheduled = false
const cronOptions = {
       // scheduled: false
       // timezone: "America/New_York"
};
// trigger cronjob
// job.start();


// run a cronjob every 15 seconds that exports messages into mySQL
const job = nodeCron.schedule("*/15 * * * * *", () => {
  console.log('----- Cron Triggered -----');
  console.log(new Date().toLocaleString());
  let exportData = false;
  client.llen("messagesQueue", (err, messageQueueLength) => {
      if (messageQueueLength > 0) {
          client.lrange("messagesQueue", "0", messageQueueLength, (err, data) => {
            if(data) {
                triggerDatabaseInsert(data, messageQueueLength);
            }
          });
      }
  });
}, cronOptions);



io.on("connection", socket => {
    fetchMessages(socket);   //  gather existing redis messages upon initial connection
    socket.on("message", ({ message, from }) => {
        const now = Date.now();
        client.rpush("messages", `${now}:${from}:${message}`);       // push time-stamped message into redis list
        client.rpush("messagesQueue", `${now}:${from}:${message}`);  // push time-stamped message into db queue list
        io.emit("message", { now, from, message });                  // emit message via socket.io so it's visible to all users right away
    });
});



// Must create a .env file in root directory to create the custom process.env.* values (see README)
function triggerDatabaseInsert(data, messageQueueLength) {
    let con = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: process.env.DB_PORT
    });
    con.connect(function(err) {
      if (err) throw err;
      console.log("Connected!");
      var sql = "INSERT INTO messages (data) VALUES ?";
      const values = data.map(thisData => { return [thisData] });
      console.log('----- Inserting data into mySQL -----');
      console.log(values);
      con.query(sql, [values], function (err, result) {
        if (err) throw err;
        console.log("Number of records inserted: " + result.affectedRows);
        if (result.affectedRows === data.length && result.affectedRows === messageQueueLength) {
            return trimFromMessageQueue(messageQueueLength);
        }
      });
    });
}


function trimFromMessageQueue(messageQueueLength) {
    client.ltrim("messagesQueue", messageQueueLength, "-1", (trimErr, trimData) => {
      exportData = trimData;
      console.log('----- Emptying Messages Queue -----');
      // console.log(exportData);
    });
}

