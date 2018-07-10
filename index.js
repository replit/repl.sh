#!/usr/bin/env node

const WebSocket = require('ws');
const request = require('request-promise');
const readline = require('readline');
const ora = require('ora');
const program = require('commander');
const package = require('./package.json');
const payloads = require('./payloads.js');
 
program
  .version(package.version)
  .option('-G, --goval [host]', 'Goval host to connect to', 'eval.repl.it')
  .option('-l, --language [language]', 'Language to use', 'bash')
  .parse(process.argv);

let fo = o => o[Object.keys(o)[0]];

function exit(n){
    console.log("\nIf you like this, you might want to check out Repl.it");
    process.exit(n);
}


let prompt = (s) => spinner.text = s;
const spinner = ora("Let's Go!").start();

if ( !payloads[program.language] ) {
    spinner.fail("Unsupported language: " + program.language);
    exit(1);
}

let payload = payloads[program.language];


;(async function() {
    prompt("Fetching free container from Repl.it ...")
    let resp = await request({
        url: 'https://repl.it/languages/' + payload.lang,
        headers: {
            //'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36'
            'User-Agent': 'Mozilla/5.0 (repl.sh)'
        },
        simple: false
    });

    let sessionJSON = resp.match(/__NEXT_DATA__ = ([^\n]+)/im);
    let session = JSON.parse(sessionJSON[1]);
    //console.log(JSON.stringify(sessionJSON, null, '  '));
    let token = fo(session.props.initialState.repls.data).govalToken;
    //console.log(JSON.stringify(session, null, '  '));

    let client = new WebSocket('ws://' + program.goval + '/ws');
    let clean = false;
    prompt("Connecting...");
    client.on('close', function() {
        if ( clean ) return;
        spinner.fail("Socket closed?");
        process.exit(1);
    })
    await new Promise(function(res, rej) {
        client.on('open', (e) => {
            res(true);
        });
    });
    let send = (o) => new Promise(function(res, rej) {
        client.send(JSON.stringify(o), function err(err) {
            if ( err ) return rej(err);
            else res();
        })
    });
    let read = () => new Promise(function(res, rej) {
        client.once('message', (d) => {
            res(JSON.parse(d));
        });
    })
    prompt("Auth...");
    await(send({command: 'auth', data: token}));
    //console.log("A", await read())
    await(send({ command: 'select_language', data: payload.lang}));
    prompt("Starting shell.. "  + (payload.main || 'eval'));
    await(read());
    if ( payload.main ) {
        let files = [{
            name: payload.main,
            content: Buffer.from(payload.shell).toString('base64'),
            encoding: 'base64'
        }]
        await(send({command: 'runProject', data:JSON.stringify(files)}));
    } else {
        await(send({ command: 'eval', data: payload.prog}));
    }
    await(send({command: "input", data:"reset\r"}));

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    process.stdin.on('keypress', (str, key) => {
        //console.log(str, key);
        //console.log(key);
        send({command: 'input', data: key.sequence});
    });

    client.on('message', function(s) {
        let d = JSON.parse(s);
        if (d.command == "output" ) {
            //console.log(d);
            spinner.stop();
            process.stdout.write(d.data);
        } else if ( d.command == "result" ) {
            if ( d.error ) {
                spinner.fail(d.error);
            } else if ( d.data ) {
                spinner.succeed(d.data);
            }
            if ( process.stdin ) {
                process.stdin.setRawMode(false);
                process.stdin.end();
            }
            clean = true;
            client.close();
            exit(0);
        } else if ( d.command == "ready") {
            prompt("Got shell, waiting for prompt")
        } else {
            if ( d.error ) {
                spinner.fail(d.error);
            }
        }
    });

    
})().catch(function(err) {
    spinner.fail(err);
    exit(1);
});
