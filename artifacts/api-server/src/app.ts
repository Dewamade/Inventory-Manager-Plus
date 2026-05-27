import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(pinoHttp({
  logger,
  serializers: {
    req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
    res(res) { return { statusCode: res.statusCode }; },
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auto-seed admin user on startup
async function seedAdmin() {
  try {
    const { pool } = await import("@workspace/db");
    const existing = await pool.query("SELECT id FROM users LIMIT 1");
    if (existing.rows.length === 0) {
      const hash = crypto.createHash("sha256").update("admin123" + "gudang_salt_2024").digest("hex");
      await pool.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
        ["admin", hash, "master"]
      );
      logger.info("Admin user seeded: admin / admin123");
    }
  } catch (err) {
    logger.error({ err }, "Seed failed");
  }
}

seedAdmin();

app.use("/api", router);

// Serve frontend static files
const frontendPath = path.resolve(__dirname, "../../gudang/dist/public");
app.use(express.static(frontendPath));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

export default app;
