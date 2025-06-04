import * as Dialog from "@radix-ui/react-dialog";

interface FactionSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onSelectFaction: (factionId: number) => void;
}

interface Faction {
  id: number;
  name: string;
  characterImage: string;
}

const factions: Faction[] = [
  {
    id: 0,
    name: "dam-dao-ta-tong",
    characterImage: "/images/factions/0-character.png",
  },
  {
    id: 1,
    name: "giao-hoi-khoai-lac",
    characterImage: "/images/factions/1-character.png",
  },
];

export function FactionSelectionDialog({
  isOpen,
  onClose,
  userName,
  onSelectFaction,
}: FactionSelectionDialogProps) {
  const handleFactionSelect = (factionId: number) => {
    onSelectFaction(factionId);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[95vw] max-w-[398px] -translate-x-1/2 -translate-y-1/2 transform md:max-w-[615px]">
          <div
            className="border-bd-default flex flex-col items-center justify-center gap-4 rounded-2xl border p-4 md:gap-6 md:p-6 md:pb-8"
            style={{
              background: `
                radial-gradient(ellipse 100% 218.76% at 50% 0%, rgba(25, 23, 88, 0.81) 35%, rgba(195, 99, 239, 0.71) 100%),
                black
              `,
            }}
          >
            {/* Header */}
            <div className="flex w-full flex-col items-center gap-4">
              <h1 className="text-center text-2xl font-semibold md:text-3xl">
                Chọn giáo phái
              </h1>
              <div
                className="h-px w-full max-w-[370px]"
                style={{
                  background:
                    "linear-gradient(to right, transparent, white, transparent)",
                }}
              />
            </div>

            {/* Welcome Text */}
            <div className="flex w-full flex-col gap-1">
              <div className="text-center text-base font-medium md:text-lg">
                <span>Chào mừng, </span>
                <span className="text-txt-focus">{userName}</span>
                <span>!</span>
              </div>
              <p className="text-center text-sm font-medium md:text-base">
                Thế giới đang chờ bạn khám phá. Hãy chọn một trong 2 phe phái sau để bắt
                đầu hành trình của mình
              </p>
            </div>

            {/* Faction Selection */}
            <div className="flex w-full flex-row items-center justify-center gap-3 md:gap-6">
              {factions.map((faction) => (
                <button
                  key={faction.id}
                  onClick={() => handleFactionSelect(faction.id)}
                  className="group relative overflow-hidden transition-all hover:scale-105"
                  style={{
                    filter: "drop-shadow(0px 2.34px 16.12px rgba(117, 28, 158, 1))",
                  }}
                >
                  <div className="relative w-[159px] md:w-[255px]">
                    {/* Character Image */}
                    <div className="relative h-[159px] w-full overflow-hidden rounded-[6px] md:h-[250px] md:rounded-[9px]">
                      <img
                        src={faction.characterImage}
                        alt={faction.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
