require('dotenv').config();

if (process.env.TEST !== 'true') {
    console.log('Environment variable TEST is not set to true. Exiting MQTT mock Service...');
    return;
}

var mqtt = require('mqtt');
const protocol = 'tcp'
const host = process.env.MQTT_HOST || 'localhost'
const mqttPort = process.env.MQTT_PORT || '1883'
const clientId = process.env.MQTT_CLIENT_ID || `mqtt_${Math.random().toString(16).slice(3)}`
const connectUrl = `${protocol}://${host}:${mqttPort}`

const mqttClient = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
})

mqttClient.on('connect', () => {
    console.log(`Connected to mqtt server with url ${connectUrl}`);
    
    const topicToSubscribe = 'toothtrek/#';
    mqttClient.subscribe(topicToSubscribe, (err) => {
        if (err) {
            console.error('Error subscribing to topic:', err);
        }
    });
})

mqttClient.on('message', (topic, message) => {
    const topics = topic.split('/');
    console.log(topics);
    console.log(topics.length);
    if (topics.length == 3) {
        const parsedMessage = JSON.parse(message);
        const responseTopic = parsedMessage.responseTopic;
        const responseMessage = JSON.stringify({ "status": "success" });
        mqttClient.publish(responseTopic, responseMessage, (err) => {
            if (err) {
                console.error('Error publishing message:', err);
            }
        });
    }
});

mqttClient.on('error', (err) => {
    console.log(err)
})

const resolvers = new Map();
mqttClient.on('message', (topic, message) => {
    const resolve = resolvers.get(topic);
    if (resolve) {
        resolve(message.toString());
        resolvers.delete(topic);
    }
});

mqttClient.handleRequest = async function(req, res, requestTopic, uid,body) {
    try {
        const responseTopic = `${requestTopic}/${uid}`;
        this.subscribe(responseTopic);
        var publishJson;
        if(body){
            publishJson = JSON.stringify({ "responseTopic": responseTopic, ...body });        }
        else{
            publishJson = JSON.stringify({ "responseTopic": responseTopic });
        }
        mqttClient.publish(requestTopic, publishJson);

        // Create a new Promise for the request
        const response = await new Promise((resolve, reject) => {
            // Store the resolver in the map
            resolvers.set(responseTopic, resolve);

            // Set a timeout for the response
            const timeout = setTimeout(() => {
                mqttClient.unsubscribe(responseTopic);
                resolvers.delete(responseTopic);
                reject(new Error('Request timed out'));
            }, 15000);
        });

        mqttClient.unsubscribe(responseTopic);

        // Handle the response from the broker
        const parsedResponse = JSON.parse(response);
        if (parsedResponse.status === 'success') {
            return res.status(200).send(parsedResponse);
        }
        else {
            return res.status(400).send(parsedResponse);
        }

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

module.exports = mqttClient;