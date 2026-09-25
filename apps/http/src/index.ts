import { app } from './app';

// Long-running server for local dev and Docker. On Vercel, api/index.ts exports the app instead.
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
