let payloads = {};

payloads.bash = {
    lang: 'bash',
    main: 'main.sh',
    shell: `
TERM=xterm-color bash
`
};

payloads.c = {
    lang: 'c',
    main: 'main.c',
    shell: `
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    system("TERM=xterm-color /bin/bash");
}
`
};

payloads.go = {
    lang: 'go',
    main: 'main.go',
    shell: `
package main
import "syscall"
import "os"
func main() {
	env := append(os.Environ(), "TERM=xterm-color")
	syscall.Exec("/bin/bash", []string{}, env)
}
`
};


payloads.nodejs = {
    lang: 'nodejs',
    main: 'index.js',
    shell: `
require('child_process').spawnSync('/bin/bash', {
	env: {TERM: 'xterm-color'},
	stdio: 'inherit'
});
`
};

payloads.php = {
    lang: 'php',
    //PHP doesnt support run project :(
    //main: 'index.php',
    shell: `

system("TERM=xterm-color /bin/bash");

`
};

payloads.python = {
    lang: 'python',
    main: 'main.py',
    shell: `
import os
os.system("TERM=xterm-color /bin/bash")
`
};

payloads.python3 = {
    lang: 'python3',
    main: 'main.py',
    shell: `
import os
os.system("TERM=xterm-color /bin/bash")
`
};

payloads.ruby = {
    lang: 'ruby',
    main: 'main.rb',
    shell: `
Process.exec({"TERM"=>"xterm-color"}, "/bin/bash")
`
};

payloads.rust = {
    lang: 'rust',
    main: 'main.rs',
    shell: `
use std::process::Command;
fn main() {
	Command::new("/bin/bash")
	.env("TERM", "xterm-color")
	.status()
	.expect("shell failed to start");
}
`
};

module.exports = payloads;