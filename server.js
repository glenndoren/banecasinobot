var restify = require('restify'); 
var builder = require('botbuilder');
var prompts = require('./prompts');
var request = require('request');
var xml2js = require('xml2js');
var twilio = require('twilio');

// Find your account sid and auth token in your Twilio account Console.
var twilioClient = null;

// 'testIt' lets us easily run it as a console bot for local testing
var testIt = false;

var connector = null;
var bot = null;
if (testIt)
{
    connector = new builder.ConsoleConnector().listen();
    bot = new builder.UniversalBot(connector);
    twilioClient = twilio('AC9851fbb881c977704480fbd1ea3e0201', '17925f26eb361a46ad67118bad15d413');
}
else
{
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
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
        session.send('onDefault1');
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
        session.send('onDefault12');
        if (!session.userData.justJoined || (session.userData.justJoined == false))
        {
            session.send('onDefault3');
            session.send('Hello %s!', session.userData.name);
        }
        session.userData.justJoined = false;
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
        session.send("%s, you have $%d and your bet size is $%d. %s",
            session.userData.name,
            session.userData.money,
            session.userData.betSize,
            session.userData.justJoined ? "Just joined." : " ");
    }
]);

intents.matches(/^sms/i,
[
    function (session)
    {
        twilioClient.sendMessage({
            // send a text to this number
            to: session.userData.mobile,

            // A Twilio number you bought - see:
            // https://www.twilio.com/user/account/phone-numbers/incoming
            from: '+19419328711',

            // The body of the text message
            body: 'Hello from Bane!'

        }/*, function(error, data) {
            // Go back to the home page
            response.redirect('/');
        }*/);
    }
]);

intents.matches(/^bane/i,
[
    function (session)
    {
        // Create and send attachment
        var attachment =
        {
            //contentUrl: "https://docs.botframework.com/en-us/images/faq-overview/botframework_overview_july.png",
            //contentUrl: "https://drive.google.com/file/d/0B9X60Ya3GWxSY2Q4bFlEenRNcVk/view",
            contentUrl: "http://glenndoren.com/assets/Bane1.png",
            contentType: "image/png",
            name: "Bane.png"
        };
        var msg = new builder.Message(session).addAttachment(attachment);

        session.send(msg);
    }
]);

intents.matches(/^quote/i,
[
    function (session)
    {
        builder.Prompts.text(session, "What stock symbol?");
    },
    function (session, results)
    {
        var stockSymbol = results.response;
        request('http://dev.markitondemand.com/Api/v2/Quote?symbol=' + stockSymbol, function (error, response, body)
        {
            //Check for error
            if(error)
            {
                return console.log('Sorry, I had a problem getting that for you. Error code was ' + error);
            }

            //Check for right status code
            if (response.statusCode !== 200)
            {
                return console.log('Sorry, I had a problem getting that for you. Status code was ' + response.statusCode);
            }

            //All is good. Print the body
            //var obj = JSON.parse(body);
            xml2js.parseString(body, function (err, result)
            {
                console.dir(JSON.stringify(result));
                console.log("Company is " + result.StockQuote.Name);
                session.send("%s is %s", result.StockQuote.Symbol, result.StockQuote.LastPrice)
            });
            //console.log(body.Name);
            //console.log(body); // Show the HTML for the Modulus homepage.
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
        var prompt = "Welcome to the Casino, " + session.userData.name + "! What's your mobile phone number? (ex. 13121234567)";
        builder.Prompts.text(session, prompt);
    },
    function (session, results)
     {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.mobile = results.response;
        var prompt = "How much money do you have to play with?";
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
