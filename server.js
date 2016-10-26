//---------------------------------------------------------------------------------------------------------------------
//
//  BaneBot v0.1
//
//  Copyright (C) 2016 Glenn M. Doren - All Rights Reserved
//
//---------------------------------------------------------------------------------------------------------------------

var restify = require('restify'); 
var builder = require('botbuilder');
var prompts = require('./prompts');
var request = require('request');
var xml2js = require('xml2js');
var twilio = require('twilio');

// 'testIt' lets us easily run it as a console bot for local testing
var testIt = false;

var twilioClient = null;
var connector = null;
var bot = null;
if (testIt)
{
    // 2DO: probably best to not have twilio account SID and PASSWORD in here, but works for now. Should
    // move into dev machine environment vars
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
        console.log('%s listening to %s', server.firstName, server.url); 
    });

    // Create chat bot
    connector = new builder.ChatConnector
    ({ appId: process.env.MY_APP_ID, appPassword: process.env.MY_APP_PASSWORD }); 
    bot = new builder.UniversalBot(connector);
    server.post('/api/messages', connector.listen());
}

var model = process.env.model || 'https://api.projectoxford.ai/luis/v1/application?id=f2547192-b302-472b-a796-56411c75e390&subscription-key=7fb26790dc614487b8f5f1b5ba3cadec&q=';
var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', intents);

//---------------------------------------------------------------------------------------------------------------------
// Helper Functions
//---------------------------------------------------------------------------------------------------------------------


//---------------------------------------------------------------------------------------------------------------------

function parseEnglishNumber(numberString)
{
    //2DO...
    /*
    var thousands = ['','thousand','million', 'billion','trillion'];
    var ones = ['zero','one','two','three','four', 'five','six','seven','eight','nine'];
    var teens = ['ten','eleven','twelve','thirteen', 'fourteen','fifteen','sixteen', 'seventeen','eighteen','nineteen'];
    var tens = ['twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
    */
    return NaN;
}

//---------------------------------------------------------------------------------------------------------------------

function parseNumberEntity(numberEntity)
{
    if (numberEntity == null)
    {
        return NaN;
    }
    var parsedNum = parseFloat(numberEntity.entity);
    if (isNaN(parsedNum))
    {
        //2DO: if english text number, translate!
        return NaN;
    }
    return parsedNum;
}

//---------------------------------------------------------------------------------------------------------------------
// Bane Actions
//---------------------------------------------------------------------------------------------------------------------

function giveBones(session, numBones)
{
    console.log("give " + numBones + (numBones == 1 ? " bone" : "bones"));
    session.userData.bonesGiven += numBones;
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

//---------------------------------------------------------------------------------------------------------------------

function givePraise(session, amount)
{
    session.userData.praise += amount;
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

//---------------------------------------------------------------------------------------------------------------------
// LUIS Intents
//---------------------------------------------------------------------------------------------------------------------

intents.onBegin(
    // Note: onBegin automagically gets hit when the conversation is started...
    function (session, args, next)
    {
        // Let's establish who the user is...'
        // session.send("onBegin...");
        if (!session.userData.firstName)
        {
            session.beginDialog('/profile');
        }
        else
        {
            next();
        }
    }
);

//---------------------------------------------------------------------------------------------------------------------

intents.onDefault(
[
    function (session, args, next)
    {
        if (!session.userData.firstName)
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
            session.send('Hi %s! Ask for HELP if you need it.', session.userData.firstName);
        }
        session.userData.justJoined = false;
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('SetValue',
[
    function (session, args, next)
    {
        var numberEntity = builder.EntityRecognizer.findEntity(args.entities, 'builtin.number');
        var number = parseNumberEntity(numberEntity);
        if (isNaN(number))
        {
            session.send("Huh?");
            return;           
        }

        var itemEntity = builder.EntityRecognizer.findEntity(args.entities, 'Item');
        if (itemEntity == null)
        {
            session.send("huh?");
            return;
        }

        if (itemEntity.entity.toLowerCase().indexOf("bone") != -1)
        {
            session.userData.bones = number;
            session.send("Got it. Bones set to " + number + ".");
        }
        else if (itemEntity.entity.toLowerCase().indexOf("bet") != -1)
        {
            session.userData.betSize = number;
            session.send("Got it. Bet size set to " + number + ".");
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('Praise',
[
    function (session, args, next)
    {
        givePraise(session, 1);
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('Hello',
[
    function (session, args, next)
    {
        if (!session.userData.firstName)
        {
            // We don't have a profile yet for this user, confirm first name
            session.send("Hi!");
            session.beginDialog('/profile');
        }
        else
        {
            session.send("Hi " + session.userData.firstName);
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('GoodBye',
[
    function (session, args, next)
    {
        if (!session.userData.firstName)
        {
            // We don't have a profile yet for this user, confirm first name
            session.send("I don't even know you!");
            session.beginDialog('/profile');
        }
        else
        {
            session.send("Bye " + session.userData.firstName);
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('Help',
[
    function (session)
    {
        session.send(prompts.helpMessage);
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('Speak',
[
    function (session, args, next)
    {
        session.send("Whoof! Whoof!");
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('IncreaseValue',
[
    function (session, args, next)
    {
        var numberEntity = builder.EntityRecognizer.findEntity(args.entities, 'builtin.number');
        var number = parseNumberEntity(numberEntity);
        if (isNaN(number))
        {
            session.send("Huh?");
            return;           
        }

        var itemEntity = builder.EntityRecognizer.findEntity(args.entities, 'Item');
        if (itemEntity == null)
        {
            session.send("huh?");
            return;
        }

        if (itemEntity.entity.toLowerCase().indexOf("bone") != -1)
        {
            session.userData.bones += number;
            session.send("Got it. Bones increased by " + number + " to " + session.userData.bones + ".");
        }
        else if (itemEntity.entity.toLowerCase().indexOf("bet") != -1)
        {
            session.userData.betSize += number;
            session.send("Got it. Bet Size increased by " + number + " to " + session.userData.betSize + ".");
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('DecreaseValue',
[
    function (session, args, next)
    {
        var numberEntity = builder.EntityRecognizer.findEntity(args.entities, 'builtin.number');
        var number = parseNumberEntity(numberEntity);
        if (isNaN(number))
        {
            session.send("Huh?");
            return;           
        }

        var itemEntity = builder.EntityRecognizer.findEntity(args.entities, 'Item');
        if (itemEntity == null)
        {
            session.send("huh?");
            return;
        }

        if (itemEntity.entity.toLowerCase().indexOf("bone") != -1)
        {
            session.userData.bones -= number;
            session.send("Got it. Bones decreased by " + number + " to " + session.userData.bones + ".");
        }
        else if (itemEntity.entity.toLowerCase().indexOf("bet") != -1)
        {
            session.userData.betSize -= number;
            session.send("Got it. Bet Size decreased by " + number + " to " + session.userData.betSize + ".");
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('IdentifySelf',
[
    function (session, args, next)
    {
        var firstName = builder.EntityRecognizer.findEntity(args.entities, 'Name::FirstName');
        if (!session.userData.firstName)
        {
            // We don't have a profile yet for this user, confirm first name
            session.beginDialog('/profile');
        }
        else if (firstName)
        {
            session.send("Your name is " + firstName.entity + "?");
        }
        else
        {
            session.send('Hi! Ask for HELP if you need it.');
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('GiveItem',
[
    function (session, args, next)
    {
        var numberEntity = builder.EntityRecognizer.findEntity(args.entities, 'builtin.number');
        var number = parseNumberEntity(numberEntity);
        if (isNaN(number))
        {
            // for now, just assume 1...
            //2DO: clarify i dont understand with the user?
            number = 1;
        }

        var itemEntity = builder.EntityRecognizer.findEntity(args.entities, 'Item');
        if (itemEntity == null)
        {
            session.send("WHOOF?!");
        }
        else if (itemEntity.entity.toLowerCase().indexOf("bone") != -1)
        {
            giveBones(session, number);
        }
        else
        {
            session.send("thanks for the " + itemEntity.entity + "!");
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------
// Basic non-LUIS Intents
//---------------------------------------------------------------------------------------------------------------------

intents.matches(/^status/i,
[
    function (session)
    {
        session.send("%s, you have %d " + (session.userData.bones == 1 ? " bone" : "bones") + " and your bet size is %d.",
            session.userData.firstName,
            session.userData.bones,
            session.userData.betSize);
    }
]);

//---------------------------------------------------------------------------------------------------------------------

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

//---------------------------------------------------------------------------------------------------------------------

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

//---------------------------------------------------------------------------------------------------------------------

intents.matches(/^flip/i,
[
    function (session)
    {
        var coin = Math.floor(Math.random() * 2);
        console.log(session.userData.betSize);
        var boneString = String(session.userData.betSize) + ((session.userData.betSize == 1) ? " bone" : " bones");
        if (coin == 0)
        {
            // you lose
            session.send("Coin comes up TAILS. You lose %s. WHOOF!!", boneString);
            session.userData.bones -= session.userData.betSize;
        }
        else
        {
            // you win
            session.send("Coin comes up HEADS. You win %s!", boneString);
            session.userData.bones += session.userData.betSize;
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches(/^reset/i,
[
    function (session)
    {
        delete session.userData.firstName;
        session.send("UserData reset.");
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches(/^bet/i,
[
    function (session)
    {
        builder.Prompts.number(session, "How many bones is your bet size?");
    },
    function (session, results)
    {
        session.userData.betSize = results.response;
        session.send("Ok. Bet size is %d %s.", session.userData.betSize, (session.userData.betSize == 1) ? " bone" : " bones");
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches(/^bones/i,
[
    function (session)
    {
        builder.Prompts.number(session, "How many bones do you have?");
    },
    function (session, results)
    {
        session.userData.bones = results.response;
        if (session.userData.numBones == 1)
        {
           session.send("Yum! That bone looks tasty.");
        }
        else
        {
            session.send("Yum! Those %d bones look tasty.", session.userData.bones);
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------

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

//---------------------------------------------------------------------------------------------------------------------

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

//---------------------------------------------------------------------------------------------------------------------

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
            body: 'Hello from Bane, K9 Prince of Belltown! ' + session.userData.firstName + ' told me to ping ya :D'
        });
        session.send("Invite sent. I hope they play with me!");
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches(/^askName/i,
[
    function (session, args, next)
    {
        session.beginDialog('/askNameDialog');
    }
]);

//---------------------------------------------------------------------------------------------------------------------

bot.dialog('/askNameDialog',
[
    // Just playing around with prompts and whether it makes sense to break out "interviewing" the user via
    // a dialog per profile "field". For example, this dialog handles getting the user's name and
    // confirming it.
    function (session, args, next)
    {
        /*
        if (session.userData.reset)
        {
            session.userData.bonesGiven = 0;
            session.userData.praise = 0;
            session.userData.firstName = null;
            session.userData.reset = null;
        }
        */
        builder.Prompts.text(session, "What's your first name?");
    },
    function (session, results)
    {
        // We'll save the users firstName and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.temp = results.response;
        builder.Prompts.text(session, "Your first name is '" + session.userData.temp + "'?");
    },
    function (session, results)
    {
        // As long as their response starts with 'y', we'll assume they meant yes :)'
        if (results.response.toLowerCase().indexOf("y") == 0)
        {
            session.userData.firstName = session.userData.temp;
            session.send("Roger that!");
        }
        else
        {
            session.send("No prob. Forgotten already.");
        }
        session.endDialog();
    }
]);

//---------------------------------------------------------------------------------------------------------------------

bot.dialog('/profile',
[
    function (session, args, next)
    {
        if (!session.userData.firstName)
        {
            session.userData.bonesGiven = 0;
            session.userData.praise = 0;
            builder.Prompts.text(session, "I'm Bane! What's your first name?");
        }
        else
        {
            next();
        }
    },
    function (session, results)
    {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.firstName = results.response;
        var prompt = "Hi, " + session.userData.firstName + "! What's your mobile phone number? (eg: 13124465983)";
        builder.Prompts.text(session, prompt);
    },
    function (session, results)
     {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.mobile = results.response;
        var prompt = "How many bones do you have to play with? (eg: 10)";
        builder.Prompts.number(session, prompt);
    },
    function (session, results)
    {
        // We'll save the users name and ask him for his starting money. All
        // future messages from the user will be routed to the root dialog.
        session.userData.bones = results.response;
        var prompt = "How many bones do you want to bet per game when we play for keeps? (eg: 1)";
        builder.Prompts.number(session, prompt);
    },
    function (session, results)
    {
        // We'll save the users name and send them an initial greeting. All
        // future messages from the user will be routed to the root dialog.
        session.userData.betSize = results.response;
        session.userData.justJoined = true;
        //session.send("%s, play with your $%d wisely.", session.userData.firstName, session.userData.money);
        session.endDialog("%s, welcome to my turf :) I can't wait to get those %d bones!", session.userData.firstName, session.userData.bones);
    }
]);

//---------------------------------------------------------------------------------------------------------------------

