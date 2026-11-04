#!/usr/bin/env python3
"""Proxy HTTP CONNECT con allowlist, da far girare SUL TUO MAC.

Serve a far uscire dall'IP di casa SOLO le richieste di Facebook Marketplace del server
(Facebook blocca gli IP dei datacenter). Il server lo raggiunge tramite un tunnel SSH inverso
(vedi deploy/fb-tunnel.sh). Non è un proxy generico: accetta solo CONNECT verso la porta 443 di
facebook.com e fbcdn.net, quindi il server non può usarlo per raggiungere la tua rete di casa,
localhost o altri siti. Ascolta solo su 127.0.0.1.

Uso:  python3 deploy/fb-egress-proxy.py [--port 18081]
"""
from __future__ import annotations

import argparse
import asyncio
import re
import sys

ALLOWED = re.compile(r"^(?:[a-z0-9-]+\.)*(?:facebook\.com|fbcdn\.net)$", re.IGNORECASE)
MAX_HEADER = 8192
IDLE_TIMEOUT = 60


async def pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while True:
            data = await asyncio.wait_for(reader.read(65536), IDLE_TIMEOUT)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except (asyncio.TimeoutError, ConnectionError, OSError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def handle(client_r: asyncio.StreamReader, client_w: asyncio.StreamWriter) -> None:
    try:
        head = await asyncio.wait_for(client_r.readuntil(b"\r\n\r\n"), 15)
    except (asyncio.TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError, ConnectionError):
        client_w.close()
        return
    if len(head) > MAX_HEADER:
        client_w.close()
        return
    first = head.split(b"\r\n", 1)[0].decode("latin-1", "replace")
    parts = first.split(" ")
    if len(parts) != 3 or parts[0] != "CONNECT":
        client_w.write(b"HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n")
        await client_w.drain()
        client_w.close()
        return
    host, _, port = parts[1].rpartition(":")
    if not ALLOWED.match(host) or port != "443":
        print(f"[fb-proxy] RIFIUTATO {parts[1]}", file=sys.stderr, flush=True)
        client_w.write(b"HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")
        await client_w.drain()
        client_w.close()
        return
    try:
        up_r, up_w = await asyncio.wait_for(asyncio.open_connection(host, 443), 15)
    except (asyncio.TimeoutError, OSError):
        client_w.write(b"HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n")
        await client_w.drain()
        client_w.close()
        return
    client_w.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
    await client_w.drain()
    await asyncio.gather(pipe(client_r, up_w), pipe(up_r, client_w))


async def main(port: int) -> None:
    server = await asyncio.start_server(handle, "127.0.0.1", port, limit=MAX_HEADER)
    print(f"[fb-proxy] in ascolto su 127.0.0.1:{port} (solo facebook.com / fbcdn.net, porta 443)", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=18081)
    args = ap.parse_args()
    try:
        asyncio.run(main(args.port))
    except KeyboardInterrupt:
        pass
