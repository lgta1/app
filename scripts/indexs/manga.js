// index title
db.mangas.createIndex({ title: "text" });

//example
db.mangas
  .find({ $text: { $search: "huyet tộc" } }, { score: { $meta: "textScore" } })
  .sort({ score: { $meta: "textScore" } });
