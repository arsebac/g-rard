import fp from "fastify-plugin";
import multipart from "@fastify/multipart";
import { FastifyInstance } from "fastify";

export default fp(async function multipartPlugin(app: FastifyInstance) {
  app.register(multipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 100,     // Max field value size in bytes
      fields: 10,         // Max number of non-file fields
      fileSize: 10 * 1024 * 1024, // For multipart forms, the max file size in bytes (10MB)
      files: 5,           // Max number of file fields
      headerPairs: 2000,  // Max number of header key=>value pairs
    },
  });
});
