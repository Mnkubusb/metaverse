import express from 'express';
import { router } from './routes/v1';
import cors from 'cors';

const app = express();
app.use(express.json());
const port = 3000;

app.use(cors({
    origin: 'http://localhost:3002',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

app.use("/api/v1" , router)

app.listen(process.env.PORT || port, () => {
});
