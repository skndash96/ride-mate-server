import { Router } from "express";
import { acceptInvite, declineInvite, getReceivedInvites, getSentInvites, sendInvite } from "../controllers/invites.controller";

const invitesRouter = Router();

invitesRouter.get("/sent", getSentInvites);
invitesRouter.get("/received", getReceivedInvites);
invitesRouter.post("/", sendInvite);
invitesRouter.post("/:inviteId/accept", acceptInvite);
invitesRouter.post("/:inviteId/decline", declineInvite);

export default invitesRouter;