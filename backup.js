    const { RichEmbed, Client, Util, Message } = require("discord.js");
    const fs = require("fs");
    const hastebins = require("hastebin-gen");

    let backups = JSON.parse(fs.readFileSync("./Data/backups.json", "utf8"));

    module.exports = class backup {
      constructor() {
        this.name = "backup";
        this.alias = [""];
        this.usage = "x!backup or !xbackup";
      }

      async run(client, message, args) {
        try {
          const info = client.emojis.get("655091815401127966") || "ℹ️";
          const waiting = client.emojis.get("655695570769412096") || "⌛";
          const green = client.emojis.get("655696285286006784") || "✅";
          const error = client.emojis.get("655704809483141141") || "❌";
          const warning = client.emojis.get("656030540310380574") || "⚠️";

          const guildsonlyEmbed = new RichEmbed()
            .setTitle(`${error} Error`)
            .setDescription(`This command **can't be used** in **DMs**`)
            .setColor("#a11616");

          const usersonlyEmbed = new RichEmbed()
            .setTitle(`${error} Error`)
            .setDescription(`This command **can't be used** by a **Bot**`)
            .setColor("#a11616");

          if (message.channel.type === "dm") return message.channel.send(guildsonlyEmbed);
          if (message.author.bot) return message.channel.send(usersonlyEmbed);

          if (!args[1]) {
            const embed = new RichEmbed()
              .setTitle("**x!backup** - Create & load server backups")
              .setDescription(`
    x!backup create    Create a backup
    x!backup delete    Delete one of your backups
    x!backup info      Get information about a backup
    x!backup load      Load a backup
    x!backup purge     Delete all your backups`)
              .setColor("#5DBCD2");
            return message.channel.send(embed);
          }

          // Backup Creation
          if (args[1] === "create" || args[1] === "c") {
            const highestRole = message.guild.member(client.user.id).highestRole;
            const rolesAbove = message.guild.roles.filter(r => r.comparePositionTo(highestRole) > 0);

            if (rolesAbove.size > 0) {
              const warn = new RichEmbed()
                .setTitle(`${warning} Warning`)
                .setDescription(`The bot does not have the highest role. This may cause issues restoring backups.`)
                .setColor("#a11616");
              message.channel.send(warn);
            }

            const creatingEmbed = new RichEmbed()
              .setTitle(`${waiting} Please wait...`)
              .setDescription("Creating backup...");
            message.channel.send(creatingEmbed).then(async m => {
              const id = makeid(16);

              const channels = message.guild.channels
                .sort((a, b) => a.position - b.position)
                .array()
                .map(c => ({
                  type: c.type,
                  name: c.name,
                  position: c.calculatedPosition,
                  parent: c.parent ? c.parent.name : null
                }));

              const roles = message.guild.roles
                .filter(r => r.name !== "@everyone")
                .sort((a, b) => a.position - b.position)
                .array()
                .map(r => ({
                  name: r.name,
                  color: r.color,
                  hoist: r.hoist,
                  permissions: r.permissions,
                  mentionable: r.mentionable,
                  position: r.position
                }));

              if (!backups[message.author.id]) backups[message.author.id] = {};
              backups[message.author.id][id] = {
                icon: message.guild.iconURL,
                name: message.guild.name,
                owner: message.guild.ownerID,
                members: message.guild.memberCount,
                createdAt: message.guild.createdAt,
                roles,
                channels
              };

              save();

              const result = new RichEmbed()
                .setTitle(`${info} Info`)
                .setDescription(`Backup created for **${message.guild.name}** with ID \`${id}\``)
                .addField("Usage", `\`x!backup load ${id}\`\n\`x!backup info ${id}\``)
                .setColor("#5DBCD2");

              const resultPublic = new RichEmbed()
                .setTitle(`${green} Voila!`)
                .setDescription(`Backup created: \`${id}\``)
                .addField("Usage", `\`x!backup load ${id}\`\n\`x!backup info ${id}\``)
                .setColor("#59C57B");

              message.author.send(result);
              m.edit(resultPublic);
            });
          }

          // Backup Delete
          else if (args[1] === "delete") {
            const code = args[2];
            if (!code) return message.channel.send(new RichEmbed().setTitle(`${error} Error`).setDescription("Backup ID not provided."));

            if (!backups[message.author.id] || !backups[message.author.id][code]) {
              return message.channel.send(new RichEmbed().setTitle(`${error} Error`).setDescription(`No backup found with ID \`${code}\`.`));
            }

            delete backups[message.author.id][code];
            save();

            return message.channel.send(new RichEmbed().setTitle(`${green} Success`).setDescription(`Backup \`${code}\` deleted.`));
          }

          // Backup Info
          else if (args[1] === "info" || args[1] === "i") {
            const id = args[2];
            if (!id) return message.channel.send(new RichEmbed().setTitle(`${error} Error`).setDescription("Backup ID not provided."));

            const data = backups[message.author.id]?.[id];
            if (!data) return message.channel.send(new RichEmbed().setTitle(`${error} Error`).setDescription("Backup not found."));

            const embed = new RichEmbed()
              .setTitle(data.name)
              .setThumbnail(data.icon)
              .addField("Creator", `<@${data.owner}>`, true)
              .addField("Members", data.members, true)
              .addField("Created At", data.createdAt)
              .addField("Channels", data.channels.map(c => c.name).join("\n"), true)
              .addField("Roles", data.roles.map(r => r.name).join("\n"), true);

            return message.channel.send(embed);
          }

          // Backup Purge
          else if (args[1] === "purge") {
            if (!backups[message.author.id]) {
              return message.channel.send(new RichEmbed().setTitle(`${error} Error`).setDescription("You have no backups to purge."));
            }

            const warningEmbed = new RichEmbed().setTitle(`${warning} Warning`).setDescription("Are you sure you want to delete all your backups? __This cannot be undone!__");

            message.channel.send(warningEmbed).then(msg => {
              msg.react("✅").then(() => msg.react("❌"));

              const yesFilter = (reaction, user) => reaction.emoji.name === "✅" && user.id === message.author.id;
              const noFilter = (reaction, user) => reaction.emoji.name === "❌" && user.id === message.author.id;

              const yes = msg.createReactionCollector(yesFilter, { time: 15000 });
              const no = msg.createReactionCollector(noFilter, { time: 15000 });

              yes.on("collect", () => {
                delete backups[message.author.id];
                save();
                msg.delete();
                message.channel.send(new RichEmbed().setTitle(`${green} Success`).setDescription("All your backups have been deleted."));
              });

              no.on("collect", () => {
                msg.delete();
              });
            });
          }
        } catch (e) {
          console.error(e);
          message.channel.send("An unexpected error occurred. Please try again.");
        }

        function makeid(length) {
          let result = "";
          const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
          for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
          }
          return result;
        }

        function save() {
          fs.writeFile("./Data/backups.json", JSON.stringify(backups, null, 2), err => {
            if (err) console.error("Failed to save backups:", err);
          });
        }
      }
    };
