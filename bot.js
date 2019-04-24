const Discord = require('discord.js');
const auth = require('./auth.json');
const fs = require('fs');
const client = new Discord.Client();

//TODO: Make this configurable at runtime
const emojiList = require('./emojis.json');

var guilds;
var guild;
var commandPermission = {};
var commandList = [];
var commandAliases = {};
var botName = 'polly';
var botCommand = 'po!';

//Poll class
class Poll {
    constructor(pollID, pollName) {
        this.pollID = pollID;
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
    };


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

//Load configs and settings when client is ready
client.once('ready', () => {
    console.log('Ready!');
    guilds = client.guilds.array();
    guild = guilds[0];

    //TODO: Make permission levels configurable at runtime!
    permLvl = guild.roles.find(role => role.name === "Crew 🔰");

    //Load config.json
    //TODO IMPLEMENT LOADING SETTINGS FROM CONFIG FILE
    var path = './config.json';
    var fileContents = readFile(path, 'utf8');
    var jsonContents = JSON.parse(fileContents);
    if (!(jsonContents === undefined) && jsonContents.type && jsonContents == 'config') {
        var commands = jsonContents.commands;
        botName = jsonContents.botName;
        botCommand = jsoncontents.botCommand;

        for (command in commands) {
            commandList.push(commands[command]);
            if (!(jsonContents[commands[command]] === undefined)) {
                commandAliases[commands[command]] = jsonContents[commands[command]];
            }
        }
    }

    //Set permissions from permissions.json 
    //TODO IMPLEMENT PERMISSIONS
    path = './permissions.json';
    fileContents = readFile(path, 'utf8');
    jsonContents = JSON.parse(fileContents);
    if (!(jsonContents === undefined) && jsonContents.type && jsonContents == 'permissions') {
        if (jsonContents.userPermissions === true) {
            for (command in commandList) {
                if (!(jsonContents[commandList[command]] === undefined)) {
                    commandPermission[commands[command]] = jsonContents[commandList[command]];
                }
            }

        } else {
            console.log("Permissions are not configured, anyone can call commands from the bot");
        }
    }

    //Check for stored polls and load if they exist
    path = './polls/';
    var dirFileMap = mapDir(path);
    if (!(mapDir === undefined || mapDir.length == 0)) {
        for (file in dirFileMap) {
            var fileContents = readFile(path + dirFileMap[file], 'utf8');
            var jsonContents = JSON.parse(fileContents);

            if (jsonContents.type && jsonContents.type == "poll") {
                var newPoll = new Poll(jsonContents.pollID, jsonContents.pollName);
                newPoll.botID = jsonContents.botID;
                for (option in jsonContents.pollOptions) {
                    newPoll.pollOptions[jsonContents.pollOptions[option]] = jsonContents.pollOptionsEmojis[option];
                }
                newPoll.activePoll = jsonContents.activePoll;
                if (newPoll.activePoll) {
                    var channels = client.channels.array();
                    var aChannel;
                    for (channel in channels) {
                        if (channels[channel].id == jsonContents.channelID) {
                            aChannel = channels[channel];
                            break;
                        }
                    }
                    aChannel.fetchMessage(jsonContents.pollMessageID).then(async function(message) {
                        newPoll.message = message;
                        polls[newPoll.pollID] = newPoll;
                        var messageReactions = message.reactions.array();
                        var duplicateUsers = [];
                        var firstReaction = {};
                        for (reaction in messageReactions) {
                            var containsReaction = false;
                            for (option in polls[newPoll.pollID].pollOptions) {
                                if (messageReactions[reaction].emoji.name == polls[newPoll.pollID].pollOptions[option]) {
                                    containsReaction = true;
                                }
                            }

                            if (containsReaction) {
                                //await console.log(messageReactions[reaction].emoji.name);
                                await messageReactions[reaction].fetchUsers().then(users => {
                                    var reactionUsers = users.array();
                                    for (user in reactionUsers) {
                                        //console.log(reactionUsers[user].username);
                                        if (polls[newPoll.pollID].hasVoted.includes(reactionUsers[user].id)) {
                                            messageReactions[reaction].remove(reactionUsers[user].id);
                                            if (!duplicateUsers.includes(reactionUsers[user])) {
                                                duplicateUsers.push(reactionUsers[user]);
                                            }
                                        } else if (reactionUsers[user].id != polls[newPoll.pollID].botID) {
                                            polls[newPoll.pollID].hasVoted.push(reactionUsers[user].id);
                                            firstReaction[reactionUsers[user].id] = messageReactions[reaction];
                                        }
                                    }
                                });
                            } else {
                                await messageReactions[reaction].fetchUsers().then(users => {
                                    var reactionUsers = users.array();
                                    for (user in reactionUsers) {
                                        messageReactions[reaction].remove(reactionUsers[user].id);
                                    }
                                });
                            }
                        }
                        for (user in duplicateUsers) {
                            firstReaction[duplicateUsers[user].id].remove(duplicateUsers[user]);
                            duplicateUsers[user].send("After restarting, you were found to have multiple entries in the poll,\nas a result your vote has been reset, please readd your vote");
                        }
                    });
                }
            }
        }
    }
});

//Log into client bot
client.login(auth.edge);
var polls = {};








//CODE FOR HANDELING MESSAGE EVENTS (LISTENS FOR COMMANDS)
client.on('message', (message) => {
    //MAKE PERMISSION STUFF NICER, MORE ROBUST AND FLEXIBLE
    var msgInit = message.content.substring(0, botCommand.length);
    if (msgInit == botCommand) {
        var args = getStringArgs(message.content.substring(botCommand.length));
        cmd = args[0];
        args = args.slice(1);

        try {
            cmd = resolveAlias(cmd);
        } catch(err) {
            console.log(err);
        }

        if (cmd in commandList && hasPermission(cmd, message.member)) {
            switch(cmd) {
                //<botCommand> createpoll <pollID> <pollName> <option1 ... optionN>
                case 'createpoll':
                    createPoll(message, args);
                break;
                //<botCommand> postpoll <pollID>
                case 'postpoll':
                    postPoll(message, args);
                break;
                //<botCommand> endpoll <pollID>
                case 'endpoll':
                    endPoll(message, args);
                break;
                //<botCommand> listpolls
                case 'listpolls':
                    var string = "**These are the polls I know about**\n";
                    for (poll in polls) {
                        string = string + polls[poll].id + "    " + polls[poll].pollName + "\n"; 
                    }
                    message.channel.send(string);
                break;
                //<botCommand> setalias <command> <alias>
                case 'setalias':
                    //Implement code
                break;
                //<botCommand> setpermission <command> <roleName>'
                case 'setpermission':
                    //Implement code
                break;
                //<botCommand> help
                case 'help':
                    //TODO: Store available commands in a txt or .json file instead of hard-coding it
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
        }
    }
    //TODO Implement tolkit to make user configured commands
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

            var pollSaveFile = generatePollJSON(polls[args[0]]);
            writeFile(pollSaveFile, "./polls/" + args[0] + ".json");
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

        var path = './polls/';
        deleteFile(path + polls[args[0]].pollID + '.json');
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

//Resolve if user has permissions for command
function hasPermission(cmd, member) {
    if (!(commandList.includes(cmd))) {
        return false;
    }
    
    var memberRoles = member.roles.array();
    for (role in memberRoles) {
        if (commandPermission[cmd].includes(memberRoles[role].id)) {
            return true;
        } else if (commandPermissions[cmd].includes("default")) {
            return true;
        }
    }
    return false;
}

//Resolve command aliases
function resolveAlias(cmd) {
    for (alias in commandAliases) {
        if (commandAliases[alias] == cmd) {
            return alias;
        }  else {
            const err = "ERROR: This is not an alias to any known command";
            throw err;
        }
    }
}

//Generates random number return dirFileMap;
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

//Generate poll.json
function generatePollJSON(thisPoll) {
    var string = "{\n";

    string = string + '"type": "poll",\n';
    string = string + '"pollID": "' + thisPoll.pollID + '",\n';
    string = string + '"pollName": "' + thisPoll.pollName + '",\n';
    string = string + '"botID": "' + thisPoll.botID + '",\n';

    var pollOptions = "[";
    var pollOptionsEmojis = "[";
    var firstRun = true;
    for (option in thisPoll.pollOptions) {
        if (!firstRun) {
            pollOptions = pollOptions + ',';
            pollOptionsEmojis = pollOptionsEmojis + ',';
        } else {    
            firstRun = false;
        }
        pollOptions = pollOptions + '"' + option + '"';
        pollOptionsEmojis = pollOptionsEmojis + '"' + thisPoll.pollOptions[option] + '"';
    }
    pollOptions = pollOptions + ']';
    pollOptionsEmojis = pollOptionsEmojis + ']';
    string = string + '"pollOptions": ' + pollOptions + ',\n';
    string = string + '"pollOptionsEmojis": ' + pollOptionsEmojis + ',\n';
    
    string = string + '"activePoll": ' + 'true,\n';
    string = string + '"pollMessageID": "' + thisPoll.message.id + '",\n';
    string = string + '"channelID": "' + thisPoll.message.channel.id + '"\n';

    string = string + '}'

    return string;
}

//Generate config.json
function generateConfig() {
    var config = "{\n";

    config = config + '}';
    return config;
}

//Generate permissions.json
function generatePermissions() {
    var permissions = "{\n";

    permissions = permissions + '}';
    return permissions;
}

//Update config.json when bot configuration changes
function updateConfig() {
    var config = "{\n";

    config = config + '}';
    return config;
}

//Update permissions.json when permissions change
function updatePermissions() {
    var permissions = "{\n";

    permissions = permissions + '}';
    return permissions;
}




//IO SYSTEM
//Read File
function readFile(filePath, coding) {
    //TODO: Add error checking!!!!!
    return fileContents = fs.readFileSync(filePath, coding);
}

//Write File 
function writeFile(data, path) {
    //TODO: Add error checking!!!!
    fs.writeFile(path, data, 'utf8', (err) => {
        if (err) {
            throw err;
            console.log(err);
        }
    });
}

//Delete file
function deleteFile(path) {
    fs.unlinkSync(path, (err) => {
        if (err) {
            throw err;
            console.log(err);
        }
    });
}

//Map file in a directory -> Return array of all individual files
function mapDir(dirPath) {
    //TODO: Add error cheking!!!!
    var dirFileMap = [];
    fs.readdirSync(dirPath).forEach(function(file) {
        dirFileMap.push(file);    
    });
    return dirFileMap;
}
