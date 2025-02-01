import express, { Request, Response } from 'express';
import { config } from "dotenv";
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import router from './src/router';
config();

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());
app.use(cookieParser())
app.use(cors({
  origin: "*"
}));
app.use(passport.initialize());

app.use(router);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});