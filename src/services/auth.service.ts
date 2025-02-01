import { User } from "@prisma/client";
import jwt from "jsonwebtoken";

interface JwtPayload {
  iss: string;
  iat: number;
  user: User
}

export const createAccessToken = (user: User) => {
  const payload: JwtPayload = {
    iss: "Taxi Mate",
    iat: Date.now(),
    user
  };

  const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, {
    expiresIn: "30m"
  });

  return accessToken;
}

export const createRefreshToken = (user: User) => {
  const payload: JwtPayload = {
    iss: "Taxi Mate",
    iat: Date.now(),
    user
  };

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: "30d"
  });

  return refreshToken;
}

export const verifyAccessToken = (accessToken: string) => {
  try {
    const payload = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET!) as JwtPayload;

    return payload;
  } catch (err) {
    return;
  }
}

export const verifyRefreshToken = (refreshToken: string) => {
  try {
    const payload: any = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as JwtPayload;

    return payload;
  } catch (err) {
    return;
  }
}