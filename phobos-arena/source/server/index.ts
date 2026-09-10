import { createLanServer } from "./app.ts";

const port = Number(process.env.PHOBOS_PORT ?? 4175);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PHOBOS_PORT must be 1–65535.");
const server = await createLanServer({
  port, host: process.env.PHOBOS_HOST ?? "0.0.0.0", logger: false,
  advertise: process.env.PHOBOS_ADVERTISE?.split(",").map(value => {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("PHOBOS_ADVERTISE must contain HTTP(S) origins.");
    return url.origin;
  }),
});
await server.start();
console.log(`Phobos LAN server: http://localhost:${port}`);
const addresses = server.info().addresses;
if (addresses.length) console.log(`Other devices on this network: ${addresses.join(" · ")}`);
else console.log("No private network address found. Connect to Wi-Fi or Ethernet before sharing a room.");
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  void server.stop().then(() => process.exit(0));
});
