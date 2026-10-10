import http from 'http';
import { WebSocketServer } from 'ws';
import { User } from './User';
import { RoomManager } from './RoomManager';

// Plain HTTP answers health checks (Render, load balancers); everything else must upgrade to a WebSocket.
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
        return;
    }
    res.writeHead(426, { 'Content-Type': 'text/plain' }).end('Upgrade Required');
});

// Clients send small JSON messages (join / move / chat) plus WebRTC session descriptions, which can
// reach a few KB with audio + video; anything over 16 KB is dropped with the connection.
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

wss.on('connection', function connection(ws) {

    const user = new User(ws);
    ws.on('error', console.error);

    ws.on("close", () => {
        user?.destroy()
    })
});

// WS_PORT locally (the shared .env sets PORT for the http server); hosts like Render inject PORT
const port = Number(process.env.WS_PORT ?? process.env.PORT) || 3001;
server.listen(port, () => {
    console.log(`WebSocket server listening on port ${port}`);
});

// Leave Redis presence clean when the process is stopped (deploys, scale-downs).
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        RoomManager.getInstance().shutdown().finally(() => process.exit(0));
    });
}
