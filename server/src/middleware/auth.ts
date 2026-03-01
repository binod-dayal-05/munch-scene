import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";
import { serverEnv } from "../config/env";
import { adminApp } from "../lib/firebaseAdmin";

const parseBearerToken = (headerValue?: string): string | null => {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.trim().split(/\s+/, 2);

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

export type AuthenticatedRequest = Request & {
  user: DecodedIdToken;
};

export const requireFirebaseAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (serverEnv.devBypassAuth) {
    const devMemberId = req.header("x-dev-member-id")?.trim();

    if (!devMemberId) {
      res.status(401).json({
        error: "Missing x-dev-member-id header while DEV_BYPASS_AUTH=true"
      });
      return;
    }

    (req as AuthenticatedRequest).user = {
      uid: devMemberId
    } as DecodedIdToken;
    next();
    return;
  }

  const token = parseBearerToken(req.header("authorization"));

  if (!token) {
    res.status(401).json({
      error: "Missing or invalid Authorization header"
    });
    return;
  }

  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch {
    res.status(401).json({
      error: "Invalid or expired auth token"
    });
  }
};
