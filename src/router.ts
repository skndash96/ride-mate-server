import { Router } from "express";
import usersRouter from "./routes/users.route";
import ridesRouter from "./routes/rides.route";
import invitesRouter from "./routes/invites.route";
import groupsRouter from "./routes/groups.route";
import authRouter from "./routes/auth.route";
import suggestionsRouter from "./routes/suggestions.route";
import geocodingRouter from "./routes/geocoding.route";
import loggerMiddleware from "./middlewares/logger.middleware";
import { authMiddleware } from "./middlewares/auth.middleware";

const apiRouter = Router();

apiRouter.use(authMiddleware);

apiRouter.use("/users", usersRouter);

apiRouter.use("/geocoding", geocodingRouter);

apiRouter.use("/rides", ridesRouter);

apiRouter.use("/invites", invitesRouter);

apiRouter.use("/groups", groupsRouter);

apiRouter.use("/suggestions", suggestionsRouter);

const router = Router();

router.use(loggerMiddleware);

router.use("/api", apiRouter);

router.use("/auth", authRouter);

router.get('/', (req, res ) => {
  res.send('Hello, world!');
});


export default router;