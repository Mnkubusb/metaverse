import express from 'express';
import { router } from './routes/v1';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.text({ limit: '5mb' }));
const port = 3000;

app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3002',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Global rate limit: 200 requests per minute per IP
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please slow down." },
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts, please try again later." },
});

app.use(globalLimiter);
app.use("/api/v1/signup", authLimiter);
app.use("/api/v1/signin", authLimiter);

app.use("/api/v1", router);

app.listen(process.env.PORT || port, () => {
    console.log(`Server is running on port ${process.env.PORT || port}`);
});
