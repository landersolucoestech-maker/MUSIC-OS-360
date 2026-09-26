import { build, createServer, preview } from "vite";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const command = process.argv[2] ?? "dev";
// VITE_PORT > PORT: PORT is the API's convention (Nest, 3001); prioritizing VITE_PORT
// keeps the web dev server from colliding with the API when PORT is exported.
const port = Number(process.env.VITE_PORT ?? process.env.PORT ?? 5000);

process.chdir(webRoot);

const configModule = await import(pathToFileURL(path.join(webRoot, "vite.config.mjs")).href);
const config = configModule.default ?? {};

// ROOT CAUSE (localhost died in the background): with stdin closed/non-TTY,
// `process.stdin.resume()` emits `end` immediately and releases the handle; the
// old keepAlive was `unref()` (it does not hold the event loop). During asynchronous
// gaps of Vite's startup the loop drained and Node exited with code 0,
// silently. The fix is a REF'D timer (holds the loop until SIGINT/
// SIGTERM), armed only for servers (dev/preview) — build exits normally.
function holdEventLoopForServer() {
  setInterval(() => {}, 2 ** 30);
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => process.exit(0));
  }
}

// Environment guard: fails before starting/building if the Supabase ref is invalid.

const inlineConfig = {
  ...config,
  root: webRoot,
  configFile: false,
};

if (command === "dev") {
  holdEventLoopForServer();
  const server = await createServer({
    ...config,
    root: webRoot,
    configFile: false,
    server: {
      ...(config.server ?? {}),
      host: "0.0.0.0",
      port,
      strictPort: true,
    },
  });

  await server.listen();
  server.httpServer?.on("close", () => {
    console.error("[run-vite] HTTP server closed unexpectedly");
  });
  server.printUrls();
} else if (command === "build") {
  await build(inlineConfig);
} else if (command === "preview") {
  holdEventLoopForServer();
  const server = await preview({
    ...inlineConfig,
    preview: {
      host: "0.0.0.0",
      port,
      strictPort: true,
    },
  });
  server.printUrls();
} else {
  console.error(`Unknown Vite command: ${command}`);
  process.exit(1);
}
