import cors from "cors";
import express from "express";
import { APP_NAME } from "@munchscene/shared";
import { serverEnv } from "./config/env";
import { resolveRoomRouter } from "./routes/resolveRoom";

const app = express();

app.use(
  cors({
    origin: serverEnv.clientOrigin
  })
);
app.use(express.json());
app.use(resolveRoomRouter);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: APP_NAME
  });
});

app.listen(serverEnv.port, () => {
  console.log(`${APP_NAME} server listening on port ${serverEnv.port}`);
});

export default app;
