const Discord = require('discord.js');
const auth = require('./auth.json');
const path = require('path');
const fs = require('fs');
const client = new Discord.Client();

//Make this configurable at runtime
//Implement IO system to load config files (or .json) at startup 
const emojiList = require('./emojis.json');
const botName = 'polly';
const botCommand = 'p!';

var guilds;
var guild;
var permLvl;

//Poll class
class Poll {
    constructor(pollID, pollName) {
        this.id = pollID;
        this.pollName = pollName;
        this.hideVotes = false;
        this.activePoll = false;
        //this.singleVotes = true; Implement feature to vote on multiple options

        this.pollOptions = {};
        this.pollVotes = {};
        this.hasVoted = [];
        this.message;
        this.botID = "";
    }

    set voteModeVisibility(selection) {
        this.hideVotes = seletion;
    }

    set voteModeSingle(selection) {
        this.singleVotes = selection;
    }

    generateOptions(options) {
        var emojis = emojiList.emojis;
        var numbers = emojiList.numbers;
        if (options.length > 9) {
            //for (var key in options) {
            //    var rndNum = getRandomInt(emojis.length);
            //    this.pollOptions[options[key]] = emojis[rndNum];
            //    this.pollVotes[options[key]] = 0;
            //    delete emojis[rndNum];
            //}
        } else {
            var i = 0;
            for (var key in options) {
                this.pollOptions[options[key]] = numbers[i];
                this.pollVotes[options[key]] = 0; 
                i++;
            }
        }
    }

    postPoll() {
        var string = "";
        var title = "**";
        var footer = "Vote by reacting with the corresponding reaction to this post.\nEach user only get's a single vote.";
        title = title + this.pollName + "**";

        for (var key in this.pollOptions) {
           string = string + this.pollOptions[key] + " " + key + "\n";
        }

        return generateEmbedPoll(title, string, botName, footer);
    }

    endPoll() {
        this.message.channel.fetchMessage(this.message.id).then((message) => {
            var string = "";
            var title = "**POLL RESULTS**\n";
            var footer = "";
            title = title + "**" + this.pollName + "**";

            var msgReactions = message.reactions.array();
            for (key in this.pollOptions) {
                for (var aReaction in msgReactions) {
                    if (this.pollOptions[key] == msgReactions[aReaction].emoji.name) {
                        this.pollVotes[key] = msgReactions[aReaction].users.array().length - 1;
                    }
                }
            }

            for (var key in this.pollOptions) {
                string = string + this.pollOptions[key] + " " + key + " Got " + this.pollVotes[key] + " Vote(s)\n";
            }
            
            const embed = generateEmbedPoll(title, string, botName, footer);
            message.channel.send({embed});

        });
    }

    //Make it possible to store more information
    addPollOption(option, info) {
        if (!(option in this.pollOptions)) {
            this.pollOptions[option] = info;
            this.pollVotes[option] = 0;
            return "The poll option was successfully added.";
        } else {
            return "This poll option already exists";
        }
    }

    deletePollOption(option) {
        if (!(option in this.pollOptions)) {
            return "This poll option does not exist";
        } else {
            delete this.pollOptions[option];
            delete this.pollVotes[option];
            return "The poll option was successfully removed";
        }
    }

    listPollOptions(bot, channelID) {
        var string;
        for (var key in this.pollOptions) {
            string = string + this.pollOptions[key] + '\n';
        }

        bot.sendMessage({
            to: channelID,
            message: this.pollName + ' poll options are:\n' + string
        });
    }
}

client.once('ready', () => {
    console.log('Ready!');
    guilds = client.guilds.array();
    guild = guilds[0];

    permLvl = guild.roles.find(role => role.name === "Crew 🔰");
});

client.login(auth.edge);
var polls = {};

//CODE FOR HANDELING MESSAGE EVENTS (LISTENS FOR COMMANDS)
client.on('message', (message) => {
    //MAKE PERMISSION STUFF NICER, MORE ROBUST AND FLEXIBLE 
    if ((message.content.substring(0, botCommand.length) == botCommand) && message.member.roles.array().includes(permLvl)) {
        var args = getStringArgs(message.content.substring(botCommand.length + 1));
        cmd = args[0];
        args = args.slice(1);

        switch(cmd) {
        //!<botCommand> createpoll <pollID> <pollName> <option1 ... optionN>
        case 'createpoll':
            createPoll(message, args);
        break;
        //!<botCommand> postpoll <pollID>
        case 'postpoll':
            postPoll(message, args);
        break;
        //!<botCommand> endpoll <pollID>
        case 'endpoll':
            endPoll(message, args);
        break;
        //!<botCommand> listpolls
        case 'listpolls':
            var string = "**These are the polls I know about**\n";
            for (poll in polls) {
                string = string + polls[poll].id + "    " + polls[poll].pollName + "\n"; 
            }
            message.channel.send(string);
        break;
        //!<botName> help
        case 'help':
            var string = "My name is " + botName + " and these are my skills!\n";
            string = string + botCommand + " createpoll <pollID> <pollName> <option1 ... optionN>\n";
            string = string + botCommand + " postpoll <pollID>\n";
            string = string + botCommand + " endpoll <pollID>\n";
            string = string + botCommand + " listpolls";
            message.channel.send(string);
        break;
        default:
            message.channel.send("I don't know what you want from me. :/");
        break;
        }
    } else if (message.content.substring(0, botName.length + 1) == '!' + botName) {
        message.channel.send("You are not powerfull enough to beckon " + botName);
    }
});

//CODE FOR HANDLING MESSAGE REACTIONS ADDED TO CACHED POSTS (NB!NB!NB! CHECK IF CASHING IS SUFFICIENT OR IF RAW EVENT IS NEEDED!)
client.on('messageReactionAdd', (reaction, user) => {
    for (poll in polls) {
        if (pollReactionAdd(reaction, user, poll)) {
            break;
        }
    }
});

//CODE FOR HANDLING MESSAGE REACTIONS REMOVED FROM CAHCED POSTS (NB!NB!NB! CHECK IF CASHING IS SUFFICIENT OR IF RAW EVENT IS NEEDED!)
//FIX BUG WHERE VOTE WILL BE INCORRECTLY UPDATED WHEN USERS TRIES TO SWITCH VOTES TOO QUICKLY
client.on('messageReactionRemove', (reaction, user) => {
    for (poll in polls) {
        var thisPoll = polls[poll];
        if (!(thisPoll.hideVotes) && reaction.message.id == thisPoll.message.id) {
            pollReactionRemove(reaction, user, thisPoll);
            break;
        }
    }
});

//REVISIT IF THERE ARE EASIER WAYS TO HANDLE THIS
//FUNCTIONS FOR HANDLING REACTIONS
//Returns bool value, handles reactions on polls for voting
function pollReactionAdd(reaction, user, poll) {
    var thisPoll = polls[poll];
    if (reaction.message.id == thisPoll.message.id && !(user.id == thisPoll.botID)) {
        if (!(thisPoll.hasVoted.includes(user.id))) {
           var optionExists = false;
           for (key in thisPoll.pollOptions) {
               if (reaction.emoji.name == thisPoll.pollOptions[key]) {
                   thisPoll.hasVoted.push(user.id);
                   optionExists = true
                   break;
               }
           }

           if (!(optionExists)) {
            user.send("This is not an option in this poll 2!");
            reaction.remove(user);
           }
        } else {
            var optionExists = false;
            var messageEmojis = reaction.message.reactions.array();
            for (key in thisPoll.pollOptions) {
                if (reaction.emoji.name == thisPoll.pollOptions[key]) {
                    optionExists = true;
                    var users = [];
                    for (emoji in messageEmojis) {
                        users = messageEmojis[emoji].users.array();
                        for (aUser in users) {
                            if ((users[aUser].id == user.id) && (messageEmojis[emoji].emoji.name != reaction.emoji.name)) {
                                messageEmojis[emoji].remove(user);
                                //break;
                            }
                        }
                        //if (optionExists) break;
                    }
                    break;
                }
            }
            if (!(optionExists)) {
                user.send("This is not an option in this poll 1!");
                reaction.remove(user);
            }
        }
    } else {
        return false;
    }
        
}

//Handles reaction removal on polls for voting
function pollReactionRemove(reaction, user, thisPoll) {
    for (option in thisPoll.pollOptions) {
        if (reaction.emoji.name == thisPoll.pollOptions[option]) {
            if (thisPoll.hasVoted.includes(user.id)) {
                var messageEmojis = [];
                var users = [];
                messageEmojis = reaction.message.reactions.array();
                
                for (emoji in messageEmojis) {
                    users = messageEmojis[emoji].users.array();
                    for (aUser in users) {
                        if (users[aUser].id == user.id) {
                            return;
                        }
                    }   
                }

                for (aUser in thisPoll.hasVoted) {
                    if (thisPoll.hasVoted[aUser] == user.id) {
                        delete thisPoll.hasVoted[aUser];
                    }
                }
                return;
            }
        }
    }
}

//FUNCTIONS FOR COMMANDS
//Function for 'createpoll' command
function createPoll(message, args) {
    if (!(args[0] in polls) && !(args.length > 11)) {
        if ((args.length > 2)) {
            polls[args[0]] = new Poll(args[0], args[1]);
            polls[args[0]].generateOptions(args.slice(2));
            message.channel.send('Poll successfully created!');
        } else {
            polls[args[0]] = new Poll(args[0], args[1]);
            message.channel.send('Poll successfully creatres!');
        }
    } else if (args[0] in polls) {
        message.channel.send('A poll with this name already exists!');
    } else if ((args[0] in polls) && (args.length > 11)) {
        message.channel.send('Sorry, I currently only support 9 poll options');
    }
}

//Function for 'postpoll' command
function postPoll(message, args) {
    if (args[0] in polls) {
        const embed = polls[args[0]].postPoll();
        message.channel.send({embed}).then(async function(message) {
            polls[args[0]].message = message;
            polls[args[0]].botID = message.author.id;
            polls[args[0]].activePoll = true;

            for (var key in polls[args[0]].pollOptions) {
                await message.react(polls[args[0]].pollOptions[key]);
            }

        });
    } else {
        message.channel.send('This poll does not exist, did you type the name correctly?');
    }
}

//Function for 'endpoll' command
function endPoll(message, args) {
    if (args[0] in polls) {
        if (!(polls[args[0]].activePoll)) {
            message.channel.send("This is not been posted yet, and therefore cannot be ended.");
            return;
        }
        polls[args[0]].endPoll();
        delete polls[args[0]];
    } else {
        message.channel.send("This poll does not exist, did you type the name correctlty?");
    }
}

//GENERAL FUNCTIONS
//Transforms string into individual variables based on whitespace and ""
function getStringArgs(string) {
    var l = string.length;
    var args = [];
    var numArgs = 0;
    var currentArg = "";

    var compundArg = false;

    for (var i = 0; i <= l - 1; i++) {
        chr = string.charAt(i);

        if (chr == ' ' && compundArg == false && !(currentArg == "")) {
            args[numArgs] = currentArg;
            numArgs++;
            currentArg = "";
        } else if (chr == '"' && compundArg == false) {
            compundArg = true;
        } else if (chr == '"' && compundArg == true) {
            compundArg = false;
            args[numArgs] = currentArg;
            numArgs++;
            currentArg = "";
        } else {
            if (compundArg == true) {
                currentArg = currentArg + chr;
                if (i == l - 1) {
                    args[numArgs] = currentArg;
                    numArgs++;
                }
            } else if (!(chr == ' ')) {
                currentArg = currentArg + chr;
                if (i == l - 1) {
                    args[numArgs] = currentArg;
                    numArgs++;
                }
            }
        }
    }
    return args;
}

//Generates random number 
function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

//Generate Embedded Post
function generateEmbedPoll(title, string, author, footer) {
    const embed = new Discord.RichEmbed()
        .setTitle(title)
        //.setAuthor(author)
        .setColor(0x00AE86)
        .setDescription(string)
        .setFooter(footer)
        .setTimestamp();
    
    return embed;
}

