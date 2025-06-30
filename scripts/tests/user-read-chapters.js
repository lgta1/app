db.userreadchapters.remove({});

const chapterIds = [
  "6846ee57ead989219fcff2d0",
  "6846ee57ead989219fcff2d1",
  "6846ee57ead989219fcff2d2",
  "6846ee57ead989219fcff2d3",
  "6846ee57ead989219fcff2d4",
  "6846f0b2ead989219fcff2d5",
  "6846f0b2ead989219fcff2d6",
  "6846f0b2ead989219fcff2d7",
  "6846f0b2ead989219fcff2d8",
  "6846f0b2ead989219fcff2d9",
  "684beaee0d23cb37b617ed47",
  "684bf7dbe5c7927882c1ca9d",
  "684ce2435c24bdfe1dfcad1c",
  "684ce9835c24bdfe1dfcad3b",
  "684d27069aa141ab6ae86dac",
  "684d2bb79aa141ab6ae86e9f",
  "684d2dca9aa141ab6ae86f1a",
  "684d46859aa141ab6ae87357",
  "68501f1007c5fb2de4450cf6",
  "6850200d07c5fb2de4450d39",
];

for (const chapterId of chapterIds) {
  db.userreadchapters.insert({
    chapterId: chapterId,
    userId: "68328fd2cc1dc64a8b9fd267",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
