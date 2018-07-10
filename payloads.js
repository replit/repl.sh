let payloads = {};

payloads.bash = {
    lang: 'bash',
    main: 'main.sh',
    shell: `
TERM=$$TERM$$ bash
`
};

payloads.c = {
    lang: 'c',
    main: 'main.c',
    shell: `
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    system("TERM=$$TERM$$ /bin/bash");
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
	env := append(os.Environ(), "TERM=$$TERM$$")
	syscall.Exec("/bin/bash", []string{}, env)
}
`
};


payloads.lua = {
	lang: 'lua',
	//main: 'main.lua',
    shell: 'os.execute("TERM=$$TERM$$ /bin/bash")'
}


payloads.nodejs = {
    lang: 'nodejs',
    main: 'index.js',
    shell: `
require('child_process').spawnSync('/bin/bash', {
	env: {TERM: '$$TERM$$'},
	stdio: 'inherit'
});
`
};

payloads.php = {
    lang: 'php',
    //PHP doesnt support run project :(
    //main: 'index.php',
    shell: `

system("TERM=$$TERM$$ /bin/bash");

`
};

payloads.python = {
    lang: 'python',
    main: 'main.py',
    shell: `
import os
os.system("TERM=$$TERM$$ /bin/bash")
`
};

payloads.python3 = {
    lang: 'python3',
    main: 'main.py',
    shell: `
import os
os.system("TERM=$$TERM$$ /bin/bash")
`
};

payloads.ruby = {
    lang: 'ruby',
    main: 'main.rb',
    shell: `
Process.exec({"TERM"=>"$$TERM$$"}, "/bin/bash")
`
};

payloads.rust = {
    lang: 'rust',
    main: 'main.rs',
    shell: `
use std::process::Command;
fn main() {
	Command::new("/bin/bash")
	.env("TERM", "$$TERM$$")
	.status()
	.expect("shell failed to start");
}
`
};

module.exports = payloads;