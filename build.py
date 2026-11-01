# Builds the page from its sources.
#   dist/turing-world.html           a complete web page for hosting anywhere (uses host-web.js)
#   turing-world.html                the claude.ai artifact version (uses host-artifact.js)
import json, os
rd = lambda f: open(f, encoding='utf-8').read()
ui = rd('ui.html')
core = ''.join(rd(f) for f in ['core.js', 'lang.js', 'examples.js', 'world.js'])
core = '\n'.join(l for l in core.split('\n') if not l.startswith('if (typeof module'))
core_src = 'const CORE_SRC = ' + json.dumps(core).replace('</', '<\\/') + ';\n'
# worlds/*.json: worlds saved from the app with Save as file. Each one replaces the built-in world with the same
# key, or adds a new world. Files load in name order.
files = []
if os.path.isdir('worlds'):
    for f in sorted(os.listdir('worlds')):
        if f.endswith('.json'):
            d = json.loads(rd(os.path.join('worlds', f)))
            if not d.get('key'): d['key'] = os.path.splitext(f)[0]
            files.append(d)
world_files = 'const WORLD_FILES = ' + json.dumps(files, ensure_ascii=False).replace('</', '<\\/') + ';\n'
def page(host):
    app = '\n'.join(rd(f) for f in [host, 'lib.js', 'labs.js', 'devices.js', 'manual-images.js', 'appmain.js', 'manual.js', 'theory.js'])
    return ui.replace('/*CORE*/', core).replace('/*APP*/', core_src + world_files + app)
HEAD = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n'
os.makedirs('dist', exist_ok=True)
open('dist/turing-world.html', 'w', encoding='utf-8').write(HEAD + page('host-web.js') + '\n</body>\n</html>\n')
open('turing-world.html', 'w', encoding='utf-8').write('<meta name="claude:viewport-fit-sides" content="cover">\n' + page('host-artifact.js'))
S = os.environ.get('TW_TEST_COPY', '')
if S: open(S + '/test.html', 'w', encoding='utf-8').write(rd('dist/turing-world.html'))
print(f'built dist/turing-world.html and turing-world.html ({len(files)} world file(s) from worlds/)')
