//---------------------------------------------------------------------------------------------------------------------
//
//  BaneCasinoBot v0.1
//
//  Copyright (C) 2016 Glenn M. Doren - All Rights Reserved
//
//---------------------------------------------------------------------------------------------------------------------

/*
2DO list
--------
1) Need to put all UI strings into prompts.js for localization.
2) Look at breaking out components into separate files, now that this framework is functioning.
3) Need a better model for Bane's happiness/user relationship/etc that is still memory-efficient.
4) Look at Azure Storage services--need for more persistent-state stuff and/or other files? Not critical right now, but...
5) Remove redundant calls to /profile since onBegin seems reliable.
*/

var restify = require('restify'); 
var builder = require('botbuilder');
var prompts = require('./prompts');
var request = require('request');
var xml2js = require('xml2js');
var twilio = require('twilio');

//---------------------------------------------------------------------------------------------------------------------
// Global Flags
//---------------------------------------------------------------------------------------------------------------------

// 'testIt' lets us easily run it as a console bot for local testing
var testIt = true;

// 'displayDebug' enables logging to console
var displayDebug = false;

//---------------------------------------------------------------------------------------------------------------------
// Global Vars
//---------------------------------------------------------------------------------------------------------------------

var debugLog = function(){};
var debugScreen = function(){};
var twilioClient = null;
var connector = null;
var bot = null;

//---------------------------------------------------------------------------------------------------------------------
// Main
//---------------------------------------------------------------------------------------------------------------------

if (displayDebug)
{
    debugLog = console.log;
    debugScreen = session.send;
}

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
        debugLog('%s listening to %s', server.firstName, server.url); 
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

function getRandomInteger(min, max)
{
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

var giveMoreBones = ["That's it?", "The animal shelter was more generous", "Dig deeper", "More please"];
var happyWithBones = ["Yum!", "You're my favorite person!", "Happy dog :)", "Best human!"];

function giveBones(session, numBones)
{
    debugLog("give " + numBones + (numBones == 1 ? " bone" : "bones"));
    if (numBones > session.userData.bones)
    {
        //2DO: good spot to have negative experience affect Bane's happiness... once we have a Happiness rating for him :)
        session.send("I dont see enough bones! Mean human :(");
        return;
    }
    session.userData.bonesGiven += numBones;
    session.userData.bones -= numBones;
    if (session.userData.bonesGiven > 5)
    {
        session.send(happyWithBones[getRandomInteger(0, happyWithBones.length - 1)]);
    }
    else
    {
        session.send(giveMoreBones[getRandomInteger(0, giveMoreBones.length - 1)]);
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
            session.userData.justJoined = true;
            session.beginDialog('/profile');
            debugLog("onDefault:profile");
        }
        else
        {
            next();
        }
    },
    function (session, results)
    {
        debugScreen("onDefault:justJoined=" + session.userData.justJoined);
        if (!session.userData.justJoined || (session.userData.justJoined == false))
        {
            session.send('Ask for HELP if you need it.', session.userData.firstName);
        }
        session.userData.justJoined = false;
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('SetValue',
[
    function (session, args, next)
    {
        if (!session.userData.firstName)
        {
            debugLog("SetValue:no profile");
            return;
        }
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
        if (!session.userData.firstName)
        {
            debugLog("Praise:no profile");
            return;
        }

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
            debugLog("Hello:no profile");
            return;
        }

        session.send("Hi " + session.userData.firstName);
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('GoodBye',
[
    function (session, args, next)
    {
        if (session.userData.firstName)
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
        if (!session.userData.firstName)
        {
            debugLog("Speak:no profile");
            return;
        }
        
        // This intent is currently very vague/general, so it comes up a lot. For now, rather than remove it,
        // let's just react only if it has a reasonably high score. Otherwise, we'll suggest help if we hit this with a
        // low LUIS score several times in a row...
        if (args.score > 0.7)
        {
            session.send("Whoof! Whoof!");
        }
        else
        {
            session.userData.numSpeaks++;
            // 2DO: Why does this only work if the following session.send("Whoof?") is done? Makes no sense, but have discovered through
            // debugging that this causes the numSpeaks field to persist. Otherwise, it always gets reset to 0. Perhaps the botbuilder code doesn't
            // persist userData if there aren't any session.sends? Odd, but possible bug... Should investigate. Also need to grab latest botbuilder code
            // and see if this bug is still there.
            session.send("Whoof?");
            if (session.userData.numSpeaks > 2)
            {
                session.send("Maybe HELP is needed?");
                session.userData.numSpeaks = 0;
            }
        }
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches('IncreaseValue',
[
    function (session, args, next)
    {
        if (!session.userData.firstName)
        {
            debugLog("IncreaseValue:no profile");
            return;
        }

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
        if (!session.userData.firstName)
        {
            debugLog("DecreaseValue:no profile");
            return;
        }

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
        if (!session.userData.firstName)
        {
            debugLog("IdentifySelf:no profile");
            return;
        }

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
        if (!session.userData.firstName)
        {
            debugLog("GiveItem:no profile");
            return;
        }

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
        if (!session.userData.firstName)
        {
            debugLog("Status:no profile");
            return;
        }

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
        if (!session.userData.firstName)
        {
            debugLog("Speak:no profile");
            return;
        }
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
    // Good example of using a web service to grab some info via http request...
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
                debugLog('Sorry, I had a problem getting that for you. Error code was ' + error);
                return;
            }

            // Check for right status code
            if (response.statusCode !== 200)
            {
                debugLog('Sorry, I had a problem getting that for you. Status code was ' + response.statusCode);
                return;
            }

            // Good result, so parse it and spit out the info we want...
            xml2js.parseString(body, function (err, result)
            {
                //console.dir(JSON.stringify(result));
                debugLog("Company is " + result.StockQuote.Name);
                if (result.StockQuote.LastPrice == "0")
                {
                    session.send("Hmmm... isn't that %s? My broker isn't answering :(", result.StockQuote.Name);
                }
                else
                {
                    session.send("%s is %s", result.StockQuote.Symbol, result.StockQuote.LastPrice);
                }
            });
        });
    }
]);

//---------------------------------------------------------------------------------------------------------------------

intents.matches(/^flip/i,
[
    function (session)
    {
        if (!session.userData.firstName)
        {
            debugLog("Flip:no profile");
            return;
        }

        if (session.userData.bones < session.userData.betSize)
        {
            //2DO: good spot to have negative experience affect Bane's happiness... once we have a Happiness rating for him :)
            session.send("I dont see enough bones! Mean human :(");
            return;
        }
        var coin = Math.floor(Math.random() * 2);
        debugLog(session.userData.betSize);
        var boneString = String(session.userData.betSize) + ((session.userData.betSize == 1) ? " bone" : " bones");
        if (coin == 0)
        {
            // you lose
            session.send(prompts.flipLose, boneString);
            session.userData.bones -= session.userData.betSize;
        }
        else
        {
            // you win
            session.send(prompts.flipWin, boneString);
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
        session.beginDialog('/profile');
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
        if (!session.userData.firstName)
        {
            debugLog("Bet:no profile");
            return;
        }

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
        if (!session.userData.firstName)
        {
            debugLog("Bones:no profile");
            return;
        }

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
    // For now, just give 1 bone at a time so we can more easily see the progression everytime
    // Bane gets a bone...
    /*function (session, args, next)
    {
        builder.Prompts.number(session, "How many bones can I have?!");
    },
    function (session, results)
    */
    function (session, args, next)
    {
        if (!session.userData.firstName)
        {
            debugLog("Give:no profile");
            return;
        }

        giveBones(session, 1);
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
        if (!session.userData.firstName)
        {
            debugLog("Good:no profile");
            return;
        }

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
        if (!session.userData.firstName)
        {
            debugLog("Invite:no profile");
            return;
        }

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
    // 2DO: Just playing around with prompts and whether it makes sense to break out "interviewing" the user via
    // a dialog per profile "field". For example, this dialog handles getting the user's name and
    // confirming it. Not currently used...
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

function initUserData(session)
{
    session.userData.bonesGiven = 0;
    session.userData.praise = 0;
    session.userData.numSpeaks = 0;
}

//---------------------------------------------------------------------------------------------------------------------

bot.dialog('/profile',
[
    function (session, args, next)
    {
        initUserData(session);
        builder.Prompts.text(session, "I'm Bane! What's your first name?");
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
        var prompt = "I love bones! How many bones do you have to play with? (eg: 10)";
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
        //session.send("%s, play with your $%d wisely.", session.userData.firstName, session.userData.money);
        session.endDialog("%s, welcome to my turf :) I can't wait to get those %d bones! Ask for HELP if you need it :)", session.userData.firstName, session.userData.bones);
        debugLog("User created.");
    }
]);

//---------------------------------------------------------------------------------------------------------------------

