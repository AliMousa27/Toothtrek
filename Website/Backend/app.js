var express = require("express");
var morgan = require("morgan");
var path = require("path");
var cors = require("cors");
var mqtt = require("mqtt");
const protocol = "tcp";
const host = "broker.hivemq.com";
const mqttPort = "1883";
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `${protocol}://${host}:${mqttPort}`;

var port = process.env.PORT || 3000;
const QOS = 0;
const mqttClient = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  username: "emqx",
  password: "public",
  reconnectPeriod: 1000,
});
mqttClient.on("connect", () => {
  console.log(`Connected to mqtt server with url ${connectUrl}`);
});
mqttClient.on("error", (err) => {
  return next(err);
});

// Create Express app
var app = express();
// Parse requests of content-type 'application/json'
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// HTTP request logger
app.use(morgan("dev"));
// Enable cross-origin resource sharing for frontend must be registered before api
app.options("*", cors());
app.use(cors());

console.log(new Date().toString());
// Import routes
app.get("/api", function (req, res) {
  res.json({ message: "Message from the express backend!" });
});

// Catch all non-error handler for api (i.e., 404 Not Found)
app.use("/api/*", function (req, res) {
  res.status(404).json({ message: "Not Found" });
});

app.get("/offices", function (req, res, next) {

  try {
    mqttClient.subscribe('toothtrek/timeslots/get/UID', { qos: QOS }, (error) => {
        if (error) {
            return next(error)
        }
    })
    publishToTopic('toothtrek/timeslots/get', 'offices', next);

        const messageHandler = (topic, message) => {
            if (topic === 'toothtrek/timeslots/get/UID') {
                console.log("message received and it is " + message.toString());
              mqttClient.removeListener('message', messageHandler); 
              mqttClient.unsubscribe('toothtrek/timeslots/get/UID', (error) => {
                if (error) {
                  return next(error)
                }
              })
              console.log(message.toString())
              res.status(200).json(JSON.parse(message.toString()))
            }
          } 
          mqttClient.once('message', (topic, message) => messageHandler(topic, message));
        } catch (err) { 
        return next(err);
    }
});

//regex for logins and registrations to use either or topic. and function to access body with message
app.post(
  "/logs/:type(logins|registrations)",
  addMessage,
  function (req, res, next) {
    try {
      console.log("endpoint called");
      const topic = `toothtrek/authentication/${req.params.type}`;
      publishToTopic(topic, JSON.stringify(req.bodyWithMessage), next);
      res.status(201).json({ message: req.body });
    } catch (err) {
      next(err);
    }
  }
);
/*app.post('/logs/logins', function (req, res,next) {
    try{
        const message = `User with UID ${req.body.uid} registered in at ${req.body.timestamp} with email ${req.body.email}`
        const bodyWithMessage = { ...req.body, "messsage":message }
        console.log(bodyWithMessage)
        publishToTopic('TOPIC CHANGE ME LATER', 'login',JSON.stringify(bodyWithMessage),next)
      res.status(201).json({ 'message': req.body });
    }
    catch(err){
        return next(err)
    }
});*/
// Serve static assets
var root = path.normalize(__dirname + "/..");
var client = path.join(root, "client", "dist");
app.use(express.static(client));

// Error handler (i.e., when exception is thrown) must be registered last
var env = app.get("env");

function publishToTopic(topic, message, next) {
  mqttClient.publish(topic, message, { qos: QOS, retain: false }, (error) => {
    if (error) {
      return next(error);
    }
  });
}
function addMessage(req, res, next) {
  const message = `User with UID ${req.body.uid} ${
    req.path.includes("logins") ? "logged in" : "registered"
  } at ${new Date().toString()} with email ${req.body.email}`;
  req.bodyWithMessage = { ...req.body, message: message };
  next();
}
app.use(function (err, req, res, next) {
  console.error(err.stack);
  var err_res = {
    message: err.message,
    error: {},
  };
  if (env === "development") {
    // Return sensitive stack trace only in dev mode
    err_res["error"] = err.stack;
  }
  res.status(err.status || 500);
  res.json(err_res);
});

app.listen(port, function (err) {
  if (err) throw err;
  console.log(`Express server listening on port ${port}, in ${env} mode`);
  console.log(`Backend: http://localhost:${port}/api/`);
  console.log(`Frontend (production): http://localhost:${port}/`);
});

module.exports = app;
