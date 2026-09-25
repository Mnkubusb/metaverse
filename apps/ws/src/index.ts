import { WebSocketServer } from 'ws';
import { User } from './User';

// Clients only send small JSON messages (join / move); anything bigger is dropped with the connection.
const wss = new WebSocketServer({ port: 3001, maxPayload: 4 * 1024 });

wss.on('connection', function connection(ws) {

    const user = new User(ws);
    ws.on('error', console.error);

    ws.on("close", () => {
        user?.destroy()
    })
});
