export function SummonWaifuCards({
  waifuList,
}: {
  waifuList: { id: string; image: string; name: string; stars: number }[];
}) {
  return (
    <div className="flex w-full items-center justify-center gap-4">
      {waifuList
        .filter((waifu) => waifu.stars !== 5)
        .slice(0, 3)
        .map((waifu) => (
          <img
            key={waifu.id}
            className="aspect-2/3 w-[155px] rounded-md object-cover"
            src={waifu.image}
            alt={waifu.name}
          />
        ))}
    </div>
  );
}
