import * as Dialog from "@radix-ui/react-dialog";

interface GenderSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onSelectGender: (genderId: number) => void;
}

interface Gender {
  id: number;
  name: string;
  characterImage: string;
}

const genders: Gender[] = [
  {
    id: 1,
    name: "nam",
    characterImage: "/images/genders/1-character.png",
  },
  {
    id: 0,
    name: "nữ",
    characterImage: "/images/genders/0-character.png",
  },
];

export function GenderSelectionDialog({
  isOpen,
  onClose,
  userName,
  onSelectGender,
}: GenderSelectionDialogProps) {
  const handleGenderSelect = (genderId: number) => {
    onSelectGender(genderId);
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
                Chọn giới tính
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
                Hãy chọn giới tính cho nhân vật của bạn
              </p>
            </div>

            {/* Gender Selection */}
            <div className="flex w-full flex-row items-center justify-center gap-3 md:gap-6">
              {genders.map((gender) => (
                <button
                  key={gender.id}
                  onClick={() => handleGenderSelect(gender.id)}
                  className="group relative overflow-hidden transition-all hover:scale-105"
                  style={{
                    filter: "drop-shadow(0px 2.34px 16.12px rgba(117, 28, 158, 1))",
                  }}
                >
                  <div className="relative w-[159px] md:w-[255px]">
                    {/* Character Image */}
                    <div className="relative h-[159px] w-full overflow-hidden rounded-[6px] md:h-[250px] md:rounded-[9px]">
                      <img
                        src={gender.characterImage}
                        alt={gender.name}
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
