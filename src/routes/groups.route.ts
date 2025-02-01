import { Router } from "express";
import { createGroup, cancelGroup, markGroupComplete } from "../controllers/groups.controller";

const groupsRouter = Router();

groupsRouter.post("/", createGroup)
groupsRouter.post("/full", markGroupComplete)
groupsRouter.delete("/current", cancelGroup)

export default groupsRouter;