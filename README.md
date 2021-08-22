
Overview/Architecture:

    *Frontend data management:*
    This project is designed to be a scalable real-time Pub/Sub chat application that not only supports real-time websocket messaging at scale (via socket.io & Redis), but also supports data persistence into a mySQL database at scale. The general flow is as follows: Server connection is established -> Socket.IO connection is established and tied in with the server -> Redis client is established -> As user events occur, Socket.IO events are emitted/broadcasted accordingly (e.g. when a user first joins a chat, or when a user sends a message) -> As events occur, data is pushed or pulled accordingly via Redis. It knows how to process the data since it has blocks of logic wrapped around Socket.IO subscription triggers.

    *Backend data management:*
    As each message flows into Redis, I push the message into a `messages` list, and a `messagesQueue` list. The `messages` list is what's linked up to the frontend display.  Every 15 seconds, I have a node cronjob that triggers and empties out the `messagesQueue`, and bulk inserts it into the mySQL database table.

    *Notes:*
    - This particular Pub/Sub architecture is focused on vertical-scaling (i.e. very large amount of data being processed in a short amount of time). The benefit of this architecture is that I'd be able to easily optimize for horizontal-scaling as well (i.e. very large amount of user connections in short amount of time) by spooling up additional servers and using them as nodes subscribed to the same Pub/Sub parent root node.
    - This project was not intended to focus on the frontend design
    - We could probably improve mySQL performance by dumping the `messagesQueue` data directly into a text file and loading directly from that file into mySQL  (e.g. `LOAD DATA INFILE '/path/to/messages.csv' INTO TABLE messages;`)
    - We could probably improve frontend browser performance by tweaking the way we attach new messages. Appending a new HTML element at scale feels a little resource-intensive for simply adding some text. 
    - If experiencing bulk data transfer issues, could configure Socket.IO to use only websocket connections rather than both websocket and polling.




Must have installed locally:
- redis-server
- nodejs
- npm
- mySQL
- Possibly at least 1 more I'm forgetting


Setup Instructions:
- If not installed locally, install redis-server
- Create a new mySQL database with the name `redis_socketio`
- In your new `redis_socketio` database, run the following SQL command to create our `messages` table:
```
CREATE TABLE `messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `data` TEXT,
  `db_insert_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 
```

- In the terminal, navigate to the project directory root and run the command: `npm install` (to build project's node_modules, etc)
- In the project root, create a file with the name `.env`, with the following (replace each `REPLACE_WITH_DATABASE_*` with your local information. The `.env` file is already included in .gitignore, make sure not to commit to version control. The `nodeenv` package I'm using automatically knows to look for the `.env` file):

```
DB_HOST=localhost
DB_USER=REPLACE_WITH_DATABASE_USER
DB_PASSWORD=REPLACE_WITH_DATABASE_PASSWORD
DB_DATABASE=redis_socketio
DB_PORT=REPLACE_WITH_DATABASE_PORT
```
- Depending on your local mySQL settings, you may need to increase the `max_allowed_packet` size. To do this, you can log into mySQL in a terminal, and run the following 2 commands: `set global net_buffer_length=1000000;`  and `set global max_allowed_packet=1000000000;` _(Please note, these are not ideal settings for production and could cause security issues.)_
- Open 3 separate terminal tabs
- In the first tab, navigate to the project directory root and run the command: `nodemon` (or `node index.js` if that doesn't work for w/e reason)
- In the second tab, run the command: `redis-server` (to run the Redis server)
- In the third tab (optional), run the command: `redis-cli` (if you want to use Redis commands to view the Redis data. See https://redis.io/commands/llen. In this project, our list names are "messages" and "messagesQueue")
- Open at least 2 browser tabs and visit:  http://localhost:5000/ 

