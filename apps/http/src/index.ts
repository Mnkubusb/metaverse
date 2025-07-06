import express from 'express';
import { router } from './routes/v1';
import cors from 'cors';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.text({ limit: '5mb' }));
app.use(express.json());
const port = 3000;

app.use((req, res, next) => {
  console.log('Request:', req.method, req.url);
  next();
});

app.use(cors({
    origin: 'http://localhost:3002',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }));

app.use("/api/v1" , router)

app.listen(process.env.PORT || port, () => {
  console.log(`Server is running on port ${process.env.PORT || port}`);
});
