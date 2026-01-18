import { initMongoDB } from "~/database/connection";
import { SystemLockModel } from "~/database/models/system-lock.model";

const key = process.argv[2] || "vi-hentai-auto-update";

async function main() {
  initMongoDB();
  const now = new Date();

  const before = await SystemLockModel.findOne({ key }).lean();
  await SystemLockModel.updateOne({ key }, { $set: { lockedUntil: now } });
  const after = await SystemLockModel.findOne({ key }).lean();

  console.log(
    JSON.stringify(
      {
        key,
        before: before
          ? { lockedUntil: (before as any).lockedUntil, lockedBy: (before as any).lockedBy }
          : null,
        after: after ? { lockedUntil: (after as any).lockedUntil, lockedBy: (after as any).lockedBy } : null,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
