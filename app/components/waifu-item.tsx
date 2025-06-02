import { Edit, Star, Trash2 } from "lucide-react";

export interface WaifuItemProps {
  id: string;
  name: string;
  image: string;
  stars: number;
  description: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function WaifuItem({
  id,
  name,
  image,
  stars,
  description,
  onEdit,
  onDelete,
}: WaifuItemProps) {
  return (
    <div className="bg-bgc-layer2 border-bd-default flex w-full items-center justify-start gap-4 rounded-2xl border p-4">
      <img className="h-36 w-24 rounded-lg object-cover" src={image} alt={name} />
      <div className="flex flex-col items-start justify-start gap-1">
        <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
          {name}
        </div>
        <div className="flex items-center justify-start">
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              className={`h-5 w-5 ${
                index < stars
                  ? "fill-[#FFD700] text-[#FFD700]"
                  : "fill-txt-tertiary text-txt-tertiary"
              }`}
            />
          ))}
        </div>
        <div className="text-txt-secondary font-sans text-base leading-normal font-medium">
          {description}
        </div>
        <div className="flex items-center justify-start gap-3">
          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="my-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl hover:opacity-60"
            >
              <Trash2 className="h-5 w-5 text-[#EF4444]" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(id)}
              className="my-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl hover:opacity-60"
            >
              <Edit className="h-5 w-5 text-[#10B981]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
