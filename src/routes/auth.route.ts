import { Router } from "express";
import { afterOAuthLogin, googleAuth, googleAuthCallback, signOut } from "../controllers/auth.controller";

const authRouter = Router();

authRouter.get("/google", googleAuth);

authRouter.get("/redirect/google", googleAuthCallback, afterOAuthLogin);

authRouter.get("/signout", signOut);

export default authRouter;