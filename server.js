// Add your requirements

//id 09ff0371-087e-4cb4-bde8-bf8ed549b5d4
//secret FTe7CBjTq4mad8LRKQaqcXq

var restify = require('restify'); 
var builder = require('botbuilder'); 

var appId = process.env.MY_APP_ID || "Missing app ID";
var appPassword = process.env.MY_APP_PASSWORD || "Missing app password";

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.PORT || 3000, function() 
{
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat bot
var connector = new builder.ChatConnector
({ appId: process.env.MY_APP_ID, appPassword: process.env.MY_APP_PASSWORD }); 
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// Create bot dialogs
bot.dialog('/', function (session) {
    session.send("Hello World");
});
