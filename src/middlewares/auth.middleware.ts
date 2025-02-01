import { NextFunction, Request, Response } from "express";
import { createAccessToken, verifyAccessToken, verifyRefreshToken } from '../services/auth.service';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const accessToken = req.cookies["access-token"];
  const refreshToken = req.cookies["refresh-token"];

  if (!accessToken || !refreshToken) {
    res.status(401).json({
      error: "Please login.",
      data: null
    });

    return;
  }

  let payload = verifyAccessToken(accessToken);

  if (!payload) {
    payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      res.status(401).json({
        error: "Please login",
        data: null
      });

      return;
    }

    const newAccessToken = createAccessToken(payload.user);

    res.cookie("access-token", newAccessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production"
    });
  }

  req.userId = payload.user.id;
  next();
};