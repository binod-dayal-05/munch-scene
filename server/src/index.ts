import express from "express";
import { APP_NAME } from "@munchscene/shared";
import { serverEnv } from "./config/env";
import { resolveRouter } from "./routes/resolve";

const app = express();

app.use(express.json());
app.use(resolveRouter);

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
