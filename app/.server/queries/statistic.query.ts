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
