import { GenresModel } from "~/database/models/genres.model";

export const getAllGenres = async () => {
  return await GenresModel.find({}).lean();
};
