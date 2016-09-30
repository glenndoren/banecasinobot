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

/*
// Create bot dialogs
bot.dialog('/', function (session) {
    session.send("Hello World");
});
*/

/*
var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot

var connector = new builder.ChatConnector({
    appId: process.env.MY_APP_ID,
    appPassword: process.env.MY_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

*/

// Create bot dialogs
//bot.dialog('/', function (session) {
//    session.send("Let's play!");
//});


//=========================================================
// Bots Dialogs
//=========================================================
bot.use(builder.Middleware.firstRun({ version: 1.0, dialogId: '*:/firstRun' }));
bot.dialog('/firstrun', function (session) {
    session.send("Let's play!");
});

var intents = new builder.IntentDialog();
bot.dialog('/', intents);

intents.onDefault(builder.DialogAction.send(prompts.helpMessage));

intents.matches(/^status/i,
[
    function (session)
    {
        console.log('status');
        //session.send("%s, you have $%d and your bet size is $%d.", session.userData.name, session.userData.money, session.userData.betSize)
        session.send("You have $100 and your bet size is $5.");
    }
]);
/*
intents.matches(/^bet/i,
[
    function (session)
    {
        builder.Prompts.number(session, "What is your bet size?");
    },
    function (session, results)
    {
        session.userData.betSize = results.response;
        session.send("Ok. Bet size is $%d.", session.userData.betSize);
    }
]);

intents.matches(/^flip/i,
[
    function (session)
    {
        var coin = Math.floor(Math.random() * 2);
        if (coin == 0)
        {
            // you lose
            session.send("Coin comes up TAILS. You lose $%s.", session.userData.betSize);
            session.userData.money -= session.userData.betSize;
        }
        else
        {
            // you win
            session.send("Coin comes up HEADS. You win $%s!", session.userData.betSize);
            session.userData.money += session.userData.betSize;
        }
    }
]);
*/

//bot.dialog('/', function (session) {
//    session.send("%s ($%d), what would you like to do?", session.userData.name, session.userData.money);
//    //session.send("%s, I heard: %s", session.userData.name, session.message.text);
//    //session.send("Say something else...");
//});

/*
// Install First Run middleware and dialog
bot.use(builder.Middleware.firstRun({ version: 1.0, dialogId: '*:/firstRun' }));
bot.dialog('/firstRun', [
    function (session) {
        console.log('firstRun');
        session.send("Woof!");
        builder.Prompts.text(session, "Welcome to the Casino! What's your name?");
    },
    function (session, results) {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.name = results.response;
        var prompt = "Welcome to the Casino, " + session.userData.name + "! How much money do you have to play with?";
        builder.Prompts.number(session, prompt);
    },
    function (session, results) {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.money = results.response;
        var prompt = "What is your bet size?";
        builder.Prompts.number(session, prompt);
    },
    function (session, results) {
        // We'll save the users name and send them an initial greeting. All
        // future messages from the user will be routed to the root dialog.
        session.userData.betSize = results.response;
        session.endDialog("%s, play with your $%d wisely.", session.userData.name, session.userData.money);
    }
]);
*/

