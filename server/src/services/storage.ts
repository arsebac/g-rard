import fs from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "../config";

export const storageService = {
  async saveFile(stream: NodeJS.ReadableStream, filename: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();

    const today = new Date();
    const year = today.getFullYear().toString();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");

    const relativeDir = path.join(year, month);
    const absoluteDir = path.resolve(config.uploadDir, relativeDir);

    // Extra security: ensure the folder resides within uploadDir
    if (!absoluteDir.startsWith(path.resolve(config.uploadDir))) {
      throw new Error("Attempt to exit authorized storage directory.");
    }

    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }

    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const relativePath = path.join(relativeDir, uniqueName);
    const absolutePath = path.resolve(config.uploadDir, relativePath);

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(absolutePath);
      stream.pipe(writeStream);
      writeStream.on("finish", () => resolve(relativePath.replace(/\\/g, "/")));
      writeStream.on("error", (err) => reject(err));
    });
  },

  /**
   * Deletes a file from disk
   */
  async deleteFile(relativePath: string): Promise<void> {
    const absolutePath = path.resolve(config.uploadDir, relativePath);
    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
    }
  },

  /**
   * Returns the absolute path for downloading
   */
  getAbsolutePath(relativePath: string): string {
    return path.resolve(config.uploadDir, relativePath);
  },

  /**
   * Returns a read stream for a stored file
   */
  getStream(relativePath: string): NodeJS.ReadableStream {
    return fs.createReadStream(path.resolve(config.uploadDir, relativePath));
  }
};
