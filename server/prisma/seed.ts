import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("gerard2024", 10);
  const testPassword = await bcrypt.hash("test", 10);

  await prisma.user.upsert({
    where: { email: "test@test.com" },
    update: {},
    create: { name: "Test", email: "test@test.com", passwordHash: testPassword },
  });

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
    update: { key: "CUI" },
    create: {
      name: "Cuisine",
      key: "CUI",
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

  // Tâches de démonstration — numérotées séquentiellement
  const taskDefs = [
    { title: "Choisir le modèle de cuisine",       status: "termine" as const, priority: "haute" as const,   assigneeId: user1.id, createdBy: user1.id, position: 1000 },
    { title: "Demander des devis aux cuisinistes",  status: "en_cours" as const, priority: "haute" as const,  assigneeId: user2.id, createdBy: user1.id, position: 1000 },
    { title: "Choisir le carrelage",               status: "a_faire" as const,  priority: "normale" as const, assigneeId: user1.id, createdBy: user1.id, position: 1000 },
    { title: "Contacter un électricien",           status: "a_faire" as const,  priority: "haute" as const,   assigneeId: user2.id, createdBy: user2.id, position: 2000 },
  ];

  for (let i = 0; i < taskDefs.length; i++) {
    const existing = await prisma.task.findFirst({ where: { projectId: project.id, number: i + 1 } });
    if (!existing) {
      await prisma.task.create({ data: { ...taskDefs[i], projectId: project.id, number: i + 1 } });
    }
  }

  // Mettre à jour les tâches existantes sans numéro
  const noNumber = await prisma.task.findMany({ where: { projectId: project.id, number: 0 } });
  const maxNum = await prisma.task.findFirst({ where: { projectId: project.id, number: { gt: 0 } }, orderBy: { number: "desc" } });
  let counter = (maxNum?.number ?? 0) + 1;
  for (const t of noNumber) {
    await prisma.task.update({ where: { id: t.id }, data: { number: counter++ } });
  }

  // Page wiki d'accueil — wiki global Flatulence
  const existingWikiHome = await prisma.wikiPage.findFirst({ where: { slug: "accueil" } });
  if (!existingWikiHome) {
    await prisma.wikiPage.create({
      data: {
        title: "Accueil",
        slug: "accueil",
        projectId: null,
        parentId: null,
        body: "<h1>Bienvenue dans Flatulence</h1><p>Cet espace wiki est destiné à documenter les projets de rénovation.</p>",
        contentType: "tiptap",
        createdBy: user1.id,
      },
    });
  }

  console.log("Seed terminé !");
  console.log(`Compte 1 : utilisateur1@gerard.local / gerard2024`);
  console.log(`Compte 2 : utilisateur2@gerard.local / gerard2024`);
  console.log("Changez les noms et mots de passe dans l'interface.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
