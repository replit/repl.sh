#!/usr/bin/env node
const path = require("path");
const fs = require("fs");


const glob = require("glob");
const request = require("request-promise");
const ora = require("ora");
const program = require("commander");
const payloads = require("./payloads.js");
const giparse = require("gitignore-globs");
const updateNotifier = require("update-notifier");
const qs = require("querystring");

const package = require("./package.json");

let collect = (f, o) => o.concat(glob.sync(f, { nodir: true }));

program
  .version(package.version)
  .description("  connect your local environment to repl.it")
  .option("-G, --goval [host]", "goval host to connect to", "eval.repl.it")
  .option("-P", "project mode, implies -Fwr")
  .option("-l, --language [language]", "language to use", "bash")
  .option(
    "-f, --file [value]",
    "provide file to container (takes globs)",
    collect,
    []
  )
  .option("-F", "send files in current directory, honoring .gitignore")
  .option("-w, --watch", "watch files for changes and resend them")
  .option("-c, --send [string]", "send string shell after connect")
  .option("-s, --save", "commit files back to the replit")
  .option("-r, --reset", "reset on change")
  .on("--help", () =>
    [
      "",
      "  Examples:",
      "",
      "    repl.sh      Connect to a bash shell in the cloud ",
      "    repl.sh -P   Upload the project in the current directry and attach",
      ""
    ].map(x => console.log(x))
  )
  .parse(process.argv);


let notifier = updateNotifier({ pkg: package });
global.jar = request.jar();

global.prompt = s => (spinner.text = s);
global.spinner = ora("Let's Go!").start();

//Project mode
if (program.P) {
  program.F = true;
  program.watch = true;

  if (program.language == "bash") {
    for (let lang in payloads) {
      if (
        payloads[lang].detect &&
        payloads[lang].detect({
          exists: f => {
            try {
              return !!fs.statSync(f);
            } catch (e) {
              return false;
            }
          }
        })
      ) {
        spinner.info("Detected lanauage to be: " + lang).start();
        program.language = lang;
        break;
      }
    }
  }

  if (!program.send) {
    try {
      let proc = fs.readFileSync("Procfile", "utf8");
      for (let line of proc.split(/\n/g)) {
        let entry = line.match(/^(\w+):\s*(.*)$/);
        if (!entry) continue;
        if (entry[1] == "web") {
          spinner.info("Detected start command to be: " + entry[2]).start();
          program.send = "exec " + entry[2];
          break;
        }
      }
    } catch (e) {}
  }

  if (program.send) program.reset = true;
}

global.exit = function exit(n) {
  notifier.notify();
  console.log("\nIf you like this, you might want to check out Repl.it");
  process.exit(n);
}

if (program.F) {
  let ignored = ["node_modules/**", "**/.DS_Store", "**/Thumbs.db"];
  try {
    ignored = ignored.concat(giparse(".gitignore"));
  } catch (e) {}
  program.file = program.file.concat(
    glob.sync("**", {
      nodir: true,
      ignore: ignored
    })
  );
}

//console.log(program.file);

let replid;

if (!payloads[program.language]) {
  spinner.fail("Unsupported language: " + program.language);
  exit(1);
}


;(async function() {
    let Client = require('./client');
    let client = new Client(program);
    prompt("Fetching free container from Repl.it ...");
    await client.auth();
    prompt("Connecting...");
    await client.connect();
    prompt("Starting shell.. " + (client.payload.main || "eval"));
    await client.launch();
    await client.go();
    exit(0);
})().catch(function(err) {
  spinner.fail(err);
  if (err.stack) console.log(err.stack);
  exit(1);
});
