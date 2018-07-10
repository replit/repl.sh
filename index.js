#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const WebSocket = require('ws');
const glob = require('glob');
const request = require('request-promise');
const readline = require('readline');
const ora = require('ora');
const program = require('commander');
const package = require('./package.json');
const payloads = require('./payloads.js');
const giparse = require('gitignore-globs');

let collect = (f, o) => o.concat(glob.sync(f, {nodir: true}));

program
  .version(package.version)
  .option('-G, --goval [host]', 'hoval host to connect to', 'eval.repl.it')
  .option('-l, --language [language]', 'language to use', 'bash')
  .option('-f, --file [value]', 'provide file to container', collect, [])
  .option('-F', 'send files in current directory, honoring .gitignore')
  .option('-s, --send [string]', 'send string after connect')
  .parse(process.argv);

let fo = o => o[Object.keys(o)[0]];


function exit(n){
    console.log("\nIf you like this, you might want to check out Repl.it");
    process.exit(n);
}

if ( program.F ) {
    let ignored = giparse('.gitignore');
    program.file = program.file.concat(glob.sync('**', {
        nodir: true,
        ignore: ignored
    }))
}

console.log(program.file);

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
        simple: false,
        jar: true
    });

    let sessionJSON = resp.match(/__NEXT_DATA__ = ([^\n]+)/im);
    let session = JSON.parse(sessionJSON[1]);
    let repl = fo(session.props.initialState.repls.data)
    let token = repl.govalToken;
    let slug = repl.title;

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
    await read();
    await(send({ command: 'select_language', data: payload.lang}));
    prompt("Starting shell.. "  + (payload.main || 'eval'));
    await read();

    let payshell = payload.shell.replace(/\$\$TERM\$\$/g, process.env.TERM || 'xterm-color');

    if ( payload.main ) {
        let files = [{
            name: payload.main,
            content: Buffer.from(payshell).toString('base64'),
            encoding: 'base64'
        }];

        for ( let f of program.file ) {
            files.push({
                //name: path.basename(f),
                name: f,
                content: fs.readFileSync(f, 'base64'),
                encoding: 'base64'
            })
        }

        await(send({command: 'runProject', data:JSON.stringify(files)}));
    } else {
        await (send({ command: 'eval', data: payshell}));
    }
    await (send({ command: "input", data: "reset\r" + (program.send ? program.send : '') + "\r"}));


    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    let write_buffer = [];

    process.stdin.on('keypress', (str, key) => {
        //console.log(str, key);
        //console.log(key);
        write_buffer.push(key.sequence);
    });

    function writer() {
        if ( write_buffer.length > 0 ) {
            send({command: 'input', data: write_buffer.join('')});
            write_buffer  = [];
        }
        if ( !clean ) setTimeout(writer, 5);
    }
    writer();

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
        } else if (d.command == "event:portOpen") {
            let j = JSON.parse(d.data);
            spinner.succeed(`Site open at https://${slug}--five-nine.repl.co (${j.port} -> 80)`);
        } else {
            if ( d.error ) {
                spinner.fail(d.error);
            }
            spinner.info(d.command + ":" + d.data);
        }
    });

    
})().catch(function(err) {
    spinner.fail(err);
    exit(1);
});
