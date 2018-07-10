#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const WebSocket = require('ws');
const glob = require('glob');
const request = require('request-promise');
const readline = require('readline');
const ora = require('ora');
const program = require('commander');
const payloads = require('./payloads.js');
const giparse = require('gitignore-globs');
const chokidar = require('chokidar');
const updateNotifier = require('update-notifier');
const qs = require('querystring');

const package = require('./package.json');

let collect = (f, o) => o.concat(glob.sync(f, {nodir: true}));

program
    .version(package.version)
    .description('connect your local environment to repl.it')
    .option('-G, --goval [host]', 'goval host to connect to', 'eval.repl.it')
    .option('-P', 'project mode, implies -Fwr')
    .option('-l, --language [language]', 'language to use', 'bash')
    .option('-f, --file [value]', 'provide file to container (takes globs)', collect, [])
    .option('-F', 'send files in current directory, honoring .gitignore')
    .option('-w, --watch', 'watch files for changes and resend them')
    .option('-c, --send [string]', 'send string after connect')
    .option('-s, --save', 'commit files back to the replit')
    .option('-r, --reset', 'reset on change')
    .parse(process.argv);

let fo = o => o[Object.keys(o)[0]];
let notifier = updateNotifier({pkg: package});
let jar = request.jar()

let prompt = (s) => spinner.text = s;
const spinner = ora("Let's Go!").start();

//Project mode
if ( program.P ) {
    program.F = true;
    program.watch = true;

    if ( program.language == 'bash' ) { 
        for ( let lang in payloads ) {
            if ( payloads[lang].detect && payloads[lang].detect({
                exists: (f) => !!fs.statSync(f) 
            }) ) {
               spinner.info("Detected lanauage to be: " + lang).start();
                program.language = lang;
                break;
            }
        }
    }

    if ( !program.send ) {
        try {
            let proc = fs.readFileSync('Procfile', 'utf8');
            for ( let line of proc.split(/\n/g) ) {
                let entry = line.match(/^(\w+):\s*(.*)$/)
                if ( !entry ) continue;
                if ( entry[1] == 'web' ) {
                    spinner.info("Detected start command to be: " + entry[2]).start();
                    program.send = 'exec ' + entry[2];
                    break;
                }
            }
        } catch (e) { }
    }

    if ( program.send ) program.reset = true;

}

function exit(n){
    notifier.notify();
    console.log("\nIf you like this, you might want to check out Repl.it");
    process.exit(n);
}

if ( program.F ) {
    let ignored = ['node_modules/**', '**/.DS_Store', '**/Thumbs.db'];
    try {
        ignored = ignored.concat(giparse('.gitignore'));
    } catch ( e ) {}
    program.file = program.file.concat(glob.sync('**', {
        nodir: true,
        ignore: ignored
    }))
}

//console.log(program.file);

let replid;



if ( !payloads[program.language] ) {
    spinner.fail("Unsupported language: " + program.language);
    exit(1);
}

let payload = payloads[program.language];

async function launch(send) {
  let payshell = payload.shell.replace(/\$\$TERM\$\$/g, process.env.TERM || 'xterm-color');

    if ( payload.main ) {
        let files = [{
            name: payload.main,
            content: Buffer.from(payshell).toString('base64'),
            encoding: 'base64'
        }];

        for ( let f of program.file ) {
            let b = fs.readFileSync(f);
            files.push({
                //name: path.basename(f),
                name: f,
                content: b.toString('base64'),
                encoding: 'base64'
            })
            if ( program.save ) commit(f, b);
        }

        await(new Promise((res,resj) => setTimeout(res,10000)));

        await(send({command: 'runProject', data:JSON.stringify(files)}));
    } else {
        await (send({ command: 'eval', data: payshell}));
    }

    await send({ command: "input", data: "reset\r" + (program.send ? program.send : '') + "\r"});
  
}

async function commit(file, contents) {
    let data;
    try {
       data = await request({
            url: `https://repl.it/data/repls/signed_urls/${replid}/${qs.escape(file)}`,
            jar: jar
        });
    } catch ( e ) {
        spinner.error("Couldnt get token to write " + file);
        return;
    }
    let target = JSON.parse(data).urls_by_action;
    await request({
        uri: target.write,
        method: 'PUT',
        body: contents
    });
    spinner.info("Wrote " + file + " to GCS");
}


;(async function() {
    prompt("Fetching free container from Repl.it ...")
    let resp = await request({
        url: 'https://repl.it/languages/' + payload.lang,
        headers: {
            //'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36'
            'User-Agent': 'Mozilla/5.0 (repl.sh)'
        },
        simple: false,
        jar: jar
    });

    let sessionJSON = resp.match(/__NEXT_DATA__ = ([^\n]+)/im);
    let session = JSON.parse(sessionJSON[1]);
    let repl = fo(session.props.initialState.repls.data)
    let token = repl.govalToken;
    let slug = repl.title;
    replid = repl.id;

    //console.log(JSON.stringify(repl, null, '  '));

    let client = new WebSocket('ws://' + program.goval + '/ws');
    let clean = false;
    prompt("Connecting...");
    client.on('close', function() {
        if ( clean ) return;
        spinner.fail("Socket closed?");
        return exit(1);
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

    await launch(send);
    let w;
    if ( program.watch ) {
        w = chokidar.watch(program.file,{
            awaitWriteFinish: true
        });
        w.on('change', function(file) {
            console.log(file);
            if ( program.reset ) {
                spinner.info(`File ${file} changed, restarting...`)
                send({command: 'stop'}).then(() => launch(send));
            } else {
                let fj = {
                    name: file,
                    content: fs.readFileSync(file, 'base64'),
                    encoding: 'base64'
                };

                send({
                    command: 'write',
                    data: JSON.stringify(fj)
                });
            }
        });
    }

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

    while ( !clean ) {
        let d = await read();
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
            if (w) w.close();
            return exit(0);
        } else if ( d.command == "ready") {
            prompt("Got shell, waiting for prompt")         
        } else if (d.command == "event:portOpen") {
            let j = JSON.parse(d.data);
            spinner.succeed(`Site open at https://${slug}--five-nine.repl.co (${j.port} -> 80)`);
        } else {
            if ( d.error ) {
                spinner.fail(d.error);
            } else if ( ['write','files'].indexOf(d.command) == -1 ) {
                spinner.info(d.command + ":" + d.data);
            }
        }
    }
})().catch(function(err) {
    spinner.fail(err);
    if ( err.stack ) console.log(err.stack);
    exit(1);
});
