var restify = require('restify'); 
var builder = require('botbuilder');
var prompts = require('./prompts');
var request = require('request');

// 'testIt' lets us easily run it as a console bot for local testing
var testIt = false;

var connector = null;
var bot = null;
if (testIt)
{
    connector = new builder.ConsoleConnector().listen();
    bot = new builder.UniversalBot(connector);
}
else
{
    var appId = process.env.MY_APP_ID || "Missing app ID";
    var appPassword = process.env.MY_APP_PASSWORD || "Missing app password";

    // Setup Restify Server
    var server = restify.createServer();
    server.listen(process.env.PORT || 3000, function() 
    {
        console.log('%s listening to %s', server.name, server.url); 
    });

    // Create chat bot
    connector = new builder.ChatConnector
    ({ appId: process.env.MY_APP_ID, appPassword: process.env.MY_APP_PASSWORD }); 
    bot = new builder.UniversalBot(connector);
    server.post('/api/messages', connector.listen());
}

//=========================================================
// Bots Dialogs
//=========================================================
//bot.use(builder.Middleware.firstRun({ version: 1.0, dialogId: '*:/firstRun' }));

//bot.dialog('/firstrun', function (session) {
//    session.send("Let's play!");
//});

var intents = new builder.IntentDialog();
bot.dialog('/', intents);

//intents.onDefault(builder.DialogAction.send(prompts.helpMessage));

intents.onDefault(
[
    function (session, args, next)
     {
        if (!session.userData.name)
        {
            session.beginDialog('/join');
        }
        else
        {
            next();
        }
    },
    function (session, results)
    {
        if (!session.userData.justJoined)
        {
            session.send('Hello %s!', session.userData.name);
        }
    }
]);

/*
intents.onBegin(function(session)
{
    if (!session.userData.hasOwnProperty(name))
    {
        session.beginDialog('join');
    }
    else
    {
        session.beginDialog('status');
    }
});
*/

intents.matches(/^status/i,
[
    function (session)
    {
        session.send("%s, you have $%d and your bet size is $%d.", session.userData.name, session.userData.money, session.userData.betSize);
    }
]);

intents.matches(/^msft/i,
[
    function (session)
    {
        request('http://dev.markitondemand.com/Api/v2/Quote?symbol=MSFT', function (error, response, body)
        {
            //Check for error
            if(error)
            {
                return console.log('Error:', error);
            }

            //Check for right status code
            if (response.statusCode !== 200)
            {
                return console.log('Invalid Status Code Returned:', response.statusCode);
            }

            //All is good. Print the body
            console.log(body); // Show the HTML for the Modulus homepage.
        });
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

bot.dialog('/join',
[
    function (session)
    {
        builder.Prompts.text(session, "Welcome to the Casino! What's your name?");
    },
    function (session, results)
     {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.name = results.response;
        var prompt = "Welcome to the Casino, " + session.userData.name + "! How much money do you have to play with?";
        builder.Prompts.number(session, prompt);
    },
    function (session, results)
    {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.money = results.response;
        var prompt = "What is your bet size?";
        builder.Prompts.number(session, prompt);
    },
    function (session, results)
    {
        // We'll save the users name and send them an initial greeting. All
        // future messages from the user will be routed to the root dialog.
        session.userData.betSize = results.response;
        session.userData.justJoined = true;
        //session.send("%s, play with your $%d wisely.", session.userData.name, session.userData.money);
        session.endDialog("%s, play with your $%d wisely.", session.userData.name, session.userData.money);
    }
]);
