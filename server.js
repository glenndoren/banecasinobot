var restify = require('restify'); 
var builder = require('botbuilder');
var prompts = require('./prompts');
var request = require('request');
var xml2js = require('xml2js');
var twilio = require('twilio');

var twilioClient = null;

// 'testIt' lets us easily run it as a console bot for local testing
var testIt = false;

var connector = null;
var bot = null;
if (testIt)
{
    // 2DO: probably best to not have twilio account SID and PASSWORD in here, but works for now. Should
    // move into dev machine environment vars or datafile read.
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

var intents = new builder.IntentDialog();
bot.dialog('/', intents);

//intents.onDefault(builder.DialogAction.send(prompts.helpMessage));

/*
module.exports = {
    helpMessage: "I'm Bane, the K9 Prince of Belltown! I like to play games and have fun. These are the commands I understand:\n\n" +
    "* 'STATUS'\n" +
    "* 'SPEAK Bane!'\n" +
    "* 'get a stock QUOTE'\n" +
    "* 'FLIP a coin'\n" +
    "* 'set your BET size'\n" +
    "* 'get more BONES'\n" +
    "* 'GIVE a bone'\n" +
    "* 'GOOD boy!'\n" +
    "* 'INVITE' another person'\n",
    flipResult: "Coin flip is %(coindSideUp)s. You %(result)s $%(amount)d.",
    status: "money: $%(money)d"
};
*/

intents.onDefault(
[
    function (session, args, next)
    {
        if (!session.userData.name)
        {
            session.beginDialog('/profile');
        }
        else
        {
            next();
        }
    },
    function (session, results)
    {
        if (!session.userData.justJoined || (session.userData.justJoined == false))
        {
            session.send('Hi %s! Ask for HELP if you need it.', session.userData.name);
        }
        session.userData.justJoined = false;
    }
]);

intents.matches(/^status/i,
[
    function (session)
    {
        session.send("%s, you have %d bones and your bet size is %d.",
            session.userData.name,
            session.userData.bones,
            session.userData.betSize);
    }
]);

intents.matches(/^help/i,
[
    function (session)
    {
        session.send(prompts.helpMessage);
    }
]);

intents.matches(/^speak/i,
[
    function (session)
    {
        // Create and send the pic
        // 2DO: would be best to use some storage service (e.g. Azure Blob Storage) but this works for quick test...
        var attachment =
        {
            contentUrl: "http://glenndoren.com/assets/Bane1.png",
            contentType: "image/png",
            name: "Bane.png"
        };
        var msg = new builder.Message(session).addAttachment(attachment);

        session.send(msg);
        session.send("WHOOF!");
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
            // Check for error
            if(error)
            {
                return console.log('Sorry, I had a problem getting that for you. Error code was ' + error);
            }

            // Check for right status code
            if (response.statusCode !== 200)
            {
                return console.log('Sorry, I had a problem getting that for you. Status code was ' + response.statusCode);
            }

            // Good result, so parse it and spit out the info we want...
            xml2js.parseString(body, function (err, result)
            {
                console.dir(JSON.stringify(result));
                console.log("Company is " + result.StockQuote.Name);
                session.send("%s is %s", result.StockQuote.Symbol, result.StockQuote.LastPrice)
            });
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
            session.send("Coin comes up TAILS. You lose %s bones. WHOOF!!", session.userData.betSize);
            session.userData.bones -= session.userData.betSize;
        }
        else
        {
            // you win
            session.send("Coin comes up HEADS. You win %s bones!", session.userData.betSize);
            session.userData.bones += session.userData.betSize;
        }
    }
]);

intents.matches(/^reset/i,
[
    function (session)
    {
        delete session.userData.name;
        session.send("UserData reset.");
    }
]);

intents.matches(/^bet/i,
[
    function (session)
    {
        builder.Prompts.number(session, "How many bones is your bet size?");
    },
    function (session, results)
    {
        session.userData.betSize = results.response;
        session.send("Ok. Bet size is %d bones.", session.userData.betSize);
    }
]);

intents.matches(/^bones/i,
[
    function (session)
    {
        builder.Prompts.number(session, "How many bones do you have?");
    },
    function (session, results)
    {
        session.userData.bones = results.response;
        session.send("Yum! Those %d bones look tasty.", session.userData.bones);
    }
]);

intents.matches(/^give/i,
[
    /*function (session)
    {
        builder.Prompts.number(session, "How many bones can I have?!");
    },
    function (session, results)
    */
    function (session)
    {
        session.userData.bonesGiven += 1; //results.response;
        if (session.userData.bonesGiven > 5)
        {
            session.send("You're my favorite person!");
        }
        else if (session.userData.bonesGiven > 1)
        {
            var s = "";
            for (var i = 0; i < session.userData.bonesGiven; i++)
            {
                s += "WHOOF!!! ";
            }
            session.send(s);
        }
        else
        {
            session.send("That's it?");
        }
    }
]);

intents.matches(/^good/i,
[
    /*function (session)
    {
        builder.Prompts.number(session, "How many bones can I have?!");
    },
    function (session, results)
    */
    function (session)
    {
        session.userData.praise += 1; //results.response;
        if (session.userData.praise > 2)
        {
            if (session.userData.bonesGiven < session.userData.praise)
            {
                session.send("Words are cheap. How about a bone? :D");
            }
            else
            {
                session.send("My tail is waggin'!");
            }
        }
        else
        {
            var s = "";
            for (var i = 0; i < session.userData.praise; i++)
            {
                s += "WHOOF!!! ";
            }
            session.send(s);
        }
    }
]);

intents.matches(/^invite/i,
[
    function (session)
    {
        builder.Prompts.text(session, "What mobile phone should I invite to play with me? (e.g. 13124465983)");
    },
    function (session, results)
    {
        twilioClient.sendMessage({
            to: results.response,
            from: '19419328711',
            body: 'Hello from Bane, K9 Prince of Belltown! ' + session.userData.name + ' told me to ping ya :D'
        });
        session.send("Invite sent. I hope they play with me!");
    }
]);

bot.dialog('/profile',
[
    function (session)
    {
        session.userData.bonesGiven = 0;
        session.userData.praise = 0;
        builder.Prompts.text(session, "I'm Bane! What's your name?");
    },
    function (session, results)
    {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.name = results.response;
        var prompt = "Hi, " + session.userData.name + "! What's your mobile phone number? (ex. 13124465983)";
        builder.Prompts.text(session, prompt);
    },
    function (session, results)
     {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.mobile = results.response;
        var prompt = "How many bones do you have to play with?";
        builder.Prompts.number(session, prompt);
    },
    function (session, results)
    {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.bones = results.response;
        var prompt = "How many bones do you want to bet per game when we play for keeps?";
        builder.Prompts.number(session, prompt);
    },
    function (session, results)
    {
        // We'll save the users name and send them an initial greeting. All
        // future messages from the user will be routed to the root dialog.
        session.userData.betSize = results.response;
        session.userData.justJoined = true;
        //session.send("%s, play with your $%d wisely.", session.userData.name, session.userData.money);
        session.endDialog("%s, welcome to my turf :) I can't wait to get those %d bones!", session.userData.name, session.userData.bones);
    }
]);
