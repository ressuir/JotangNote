"""Serve genuine CI evidence with an explicit UTF-8 content type."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
class EvidenceHandler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.txt':'text/plain; charset=utf-8','.log':'text/plain; charset=utf-8','.srt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'}
ThreadingHTTPServer(('127.0.0.1',8090),partial(EvidenceHandler,directory='course-output')).serve_forever()
