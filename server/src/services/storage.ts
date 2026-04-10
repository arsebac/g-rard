import fs from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "../config";

const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", 
  ".doc", ".docx", ".xls", ".xlsx", ".txt", ".md", ".json", ".zip", ".csv"
];

export const storageService = {
  /**
   * Sauvegarde un fichier sur le disque dans un dossier structuré par date
   */
  async saveFile(stream: NodeJS.ReadableStream, filename: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();
    
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`Extension de fichier non autorisée : ${ext}`);
    }

    const today = new Date();
    const year = today.getFullYear().toString();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");

    const relativeDir = path.join(year, month);
    const absoluteDir = path.resolve(config.uploadDir, relativeDir);

    // Sécurité supplémentaire : s'assurer que le dossier réside bien dans uploadDir
    if (!absoluteDir.startsWith(path.resolve(config.uploadDir))) {
      throw new Error("Tentative de sortie du dossier de stockage autoris\u00E9.");
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
   * Supprime un fichier du disque
   */
  async deleteFile(relativePath: string): Promise<void> {
    const absolutePath = path.resolve(config.uploadDir, relativePath);
    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
    }
  },

  /**
   * Retourne le chemin absolu pour le téléchargement
   */
  getAbsolutePath(relativePath: string): string {
    return path.resolve(config.uploadDir, relativePath);
  },

  /**
   * Retourne un stream de lecture pour un fichier stocké
   */
  getStream(relativePath: string): NodeJS.ReadableStream {
    return fs.createReadStream(path.resolve(config.uploadDir, relativePath));
  }
};
