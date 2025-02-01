import { NextFunction, Request, Response } from "express";

export default function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.path}`);
  next();
}