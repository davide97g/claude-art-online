#!/usr/bin/env python3
"""Client for the OFFICIAL Blender MCP extension socket (localhost:9876).

Protocol: null-byte-delimited JSON. Request:
  {"type":"execute","code":"<python>","strict_json":false}\0
The code runs in a namespace preloaded with `result = {}`; set `result` to a
dict to return data, and/or print() (captured as stdout). Response is
null-terminated JSON: {"status":"ok","result":...,"stdout":...} or
{"status":"error","message":<traceback>,...}.

Usage:
  blender_client.py exec <code_file.py>   -> run bpy code, print stdout+result
  blender_client.py ping                  -> list scene objects
"""
import socket, json, sys

HOST, PORT = 'localhost', 9876

PREAMBLE = "import bpy, mathutils, math\n"  # official addon namespace has only `result={}`

import os
def send_code(code, strict_json=False, timeout=int(os.environ.get('CAO_BLENDER_TIMEOUT', 900))):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect((HOST, PORT))
    req = json.dumps({"type": "execute", "code": PREAMBLE + code, "strict_json": strict_json}) + "\0"
    s.sendall(req.encode('utf-8'))
    dec = json.JSONDecoder()
    buf = b''
    while True:
        chunk = s.recv(1 << 16)
        if not chunk:
            break
        buf += chunk
        txt = buf.decode('utf-8', errors='ignore').lstrip()
        try:
            obj, _ = dec.raw_decode(txt)   # first complete JSON; ignore trailing \0
            s.close()
            return obj
        except json.JSONDecodeError:
            continue
    s.close()
    return {"status": "error", "message": "empty/closed", "raw": buf.decode('utf-8', 'ignore')}

def run(code):
    r = send_code(code)
    if r.get("stdout"):
        print(r["stdout"].rstrip())
    if r.get("status") == "ok":
        res = r.get("result")
        if res not in ({}, None):
            print("RESULT:", json.dumps(res, indent=2, default=str))
    else:
        print("ERROR:", r.get("message", r))
        if r.get("stderr"):
            print("STDERR:", r["stderr"])

def main():
    if len(sys.argv) < 2:
        print("need a command"); return
    c = sys.argv[1]
    if c == 'ping':
        run("result = {'objects': [o.name for o in bpy.data.objects], "
            "'blender': bpy.app.version_string}")
    elif c == 'exec':
        run(open(sys.argv[2]).read())
    else:
        print("unknown command", c)

if __name__ == '__main__':
    main()
