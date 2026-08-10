import { db, user, workspace, workspaceMember, folder } from "./client";

async function seed() {
  const [devUser] = await db
    .insert(user)
    .values({
      id: "dev-user-seed",
      name: "Dev User",
      email: "dev@filecloud.local",
      emailVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  if (!devUser) {
    console.log("Seed user already exists, skipping.");
    return;
  }

  const [ws] = await db
    .insert(workspace)
    .values({ name: "Dev User's Workspace", type: "personal", ownerId: devUser.id })
    .returning();
  if (!ws) throw new Error("workspace insert returned no row");

  await db.insert(workspaceMember).values({
    workspaceId: ws.id,
    userId: devUser.id,
    role: "owner",
  });

  await db.insert(folder).values({
    workspaceId: ws.id,
    parentId: null,
    name: "root",
  });

  console.log(`Seeded workspace ${ws.id} for user ${devUser.id}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
