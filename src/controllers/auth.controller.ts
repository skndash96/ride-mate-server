import { Request, Response } from "express";
import { createAccessToken, createRefreshToken } from "../services/auth.service";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "../prisma";
import { User } from "@prisma/client";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/auth/redirect/google"
    },
    async (accessToken, refreshToken, profile, done) => {
      const user = await prisma.user.findUnique({
        where: {
          email: profile.emails![0].value
        }
      });

      if (user === null) {
        const newUser = await prisma.user.create({
          data: {
            email: profile.emails![0].value,
            name: profile.displayName
          }
        });

        done(null, newUser);
      } else {
        done(null, user);
      }
    }
  )
);

export const googleAuth = passport.authenticate("google", {
  session: false,
  scope: ["profile", "email"]
});

export const googleAuthCallback = passport.authenticate('google', {
  session: false,
  failureRedirect: '/login'
});

export const afterOAuthLogin = (req: Request, res: Response) => {
  const user = req.user as User;

  if (!user) {
    res.redirect("/login");
    return;
  }

  const refreshToken = createRefreshToken(user);
  const accessToken = createAccessToken(user);

  res.cookie("refresh-token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  });

  res.cookie("access-token", accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production"
  });

  res.redirect("/profile");
}

export const signOut = (req: Request, res: Response) => {
  res.clearCookie("refresh-token");
  res.clearCookie("access-token");
  
  res.redirect("/login");
};