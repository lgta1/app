import { ROLES } from "~/constants/user";
import { MangaModel } from "~/database/models/manga.model";
import { StatisticModel } from "~/database/models/statistic.model";
import { UserModel } from "~/database/models/user.model";

export const getStatistic = async () => {
  const statistic = await StatisticModel.findOne({});
  const totalMembers = await UserModel.countDocuments({ role: ROLES.USER });
  const totalManga = await MangaModel.countDocuments({});

  return {
    totalViews: statistic?.totalViews || 0,
    totalMembers: totalMembers || 0,
    totalManga: totalManga || 0,
  };
};

export type DailySeriesPoint = {
  dateKey: string;
  label: string;
  count: number;
  total: number;
};

export const getDailyRegistrationAndMangaStats = async (days = 15) => {
  const TZ = "Asia/Ho_Chi_Minh";
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (Math.max(1, days) - 1));
  start.setHours(0, 0, 0, 0);

  const [userAgg, mangaAgg, userBaseCount, mangaBaseCount] = await Promise.all([
    UserModel.aggregate([
      {
        $match: {
          role: ROLES.USER,
          isDeleted: { $ne: true },
          createdAt: { $gte: start },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: TZ,
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    MangaModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: TZ,
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    UserModel.countDocuments({
      role: ROLES.USER,
      isDeleted: { $ne: true },
      createdAt: { $lt: start },
    }),
    MangaModel.countDocuments({
      createdAt: { $lt: start },
    }),
  ]);

  const userMap = new Map<string, number>(
    (userAgg || []).map((row: { _id: string; count: number }) => [row._id, row.count]),
  );
  const mangaMap = new Map<string, number>(
    (mangaAgg || []).map((row: { _id: string; count: number }) => [row._id, row.count]),
  );

  const dateKeys: Array<{ dateKey: string; label: string }> = [];
  for (let i = 0; i < Math.max(1, days); i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const label = new Intl.DateTimeFormat("vi-VN", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
    }).format(d);
    dateKeys.push({ dateKey, label });
  }

  const registrations: DailySeriesPoint[] = [];
  const mangasCreated: DailySeriesPoint[] = [];
  let runningUsers = userBaseCount ?? 0;
  let runningMangas = mangaBaseCount ?? 0;

  dateKeys.forEach((d) => {
    const dayUsers = userMap.get(d.dateKey) ?? 0;
    const dayMangas = mangaMap.get(d.dateKey) ?? 0;
    runningUsers += dayUsers;
    runningMangas += dayMangas;

    registrations.push({
      ...d,
      count: dayUsers,
      total: runningUsers,
    });

    mangasCreated.push({
      ...d,
      count: dayMangas,
      total: runningMangas,
    });
  });

  return {
    timezone: TZ,
    registrations,
    mangasCreated,
  };
};
