import { createNotification } from "@/mutations/notification.mutation";

import type { ChapterType } from "~/database/models/chapter.model";
import { type MangaType } from "~/database/models/manga.model";
import type { NotificationType } from "~/database/models/notification.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";

export const notifyToUsers = async (
  userIds: string[],
  notification: Partial<NotificationType>,
) => {
  await Promise.all(
    userIds.map(async (userId) => {
      createNotification({
        userId,
        ...notification,
      });
    }),
  );
};

export const notifyNewChapter = async (chapter: ChapterType, manga: MangaType) => {
  const usersFollowManga = await UserFollowMangaModel.find({
    mangaId: chapter.mangaId,
  }).lean();

  await notifyToUsers(
    usersFollowManga.map((user) => user.userId),
    {
      title: manga.title,
      subtitle: "đã ra chương mới",
      imgUrl: manga.poster,
    },
  );
};
