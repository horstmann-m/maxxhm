import Fastify from "fastify";
import multipart from "@fastify/multipart";
import formbody from "@fastify/formbody";
import { contactsRoutes } from "./routes/contacts.js";
import { importRoutes } from "./routes/import.js";
import { businessCardRoutes } from "./routes/businessCard.js";
import { pricesRoutes } from "./routes/prices.js";
import { whatsappRoutes } from "./routes/whatsapp.js";

const app = Fastify({ logger: true });

await app.register(multipart);
await app.register(formbody); // Twilio webhooks post application/x-www-form-urlencoded
await app.register(contactsRoutes);
await app.register(importRoutes);
await app.register(businessCardRoutes);
await app.register(pricesRoutes);
await app.register(whatsappRoutes);

app.get("/health", async () => ({ status: "ok" }));

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
