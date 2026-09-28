import http from 'http';
import { WebSocketServer } from 'ws';
import { User } from './User';

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

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => {
    console.log(`WebSocket server listening on port ${port}`);
});
