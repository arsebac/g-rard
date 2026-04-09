import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("gerard2024", 10);

  const user1 = await prisma.user.upsert({
    where: { email: "utilisateur1@gerard.local" },
    update: {},
    create: {
      name: "Utilisateur 1",
      email: "utilisateur1@gerard.local",
      passwordHash: password,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "utilisateur2@gerard.local" },
    update: {},
    create: {
      name: "Utilisateur 2",
      email: "utilisateur2@gerard.local",
      passwordHash: password,
    },
  });

  // Projet de démonstration
  const project = await prisma.project.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Cuisine",
      description: "Rénovation complète de la cuisine",
      color: "#f59e0b",
      createdBy: user1.id,
    },
  });

  // Labels de démonstration
  await prisma.label.createMany({
    skipDuplicates: true,
    data: [
      { projectId: project.id, name: "Devis", color: "#3b82f6" },
      { projectId: project.id, name: "Achat", color: "#10b981" },
      { projectId: project.id, name: "Travaux", color: "#f97316" },
    ],
  });

  // Tâches de démonstration
  await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      {
        projectId: project.id,
        title: "Choisir le modèle de cuisine",
        status: "termine",
        priority: "haute",
        assigneeId: user1.id,
        createdBy: user1.id,
        position: 1000,
      },
      {
        projectId: project.id,
        title: "Demander des devis aux cuisinistes",
        status: "en_cours",
        priority: "haute",
        assigneeId: user2.id,
        createdBy: user1.id,
        position: 1000,
      },
      {
        projectId: project.id,
        title: "Choisir le carrelage",
        status: "a_faire",
        priority: "normale",
        assigneeId: user1.id,
        createdBy: user1.id,
        position: 1000,
      },
      {
        projectId: project.id,
        title: "Contacter un électricien",
        status: "a_faire",
        priority: "haute",
        assigneeId: user2.id,
        createdBy: user2.id,
        position: 2000,
      },
    ],
  });

  console.log("Seed terminé !");
  console.log(`Compte 1 : utilisateur1@gerard.local / gerard2024`);
  console.log(`Compte 2 : utilisateur2@gerard.local / gerard2024`);
  console.log("Changez les noms et mots de passe dans l'interface.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
