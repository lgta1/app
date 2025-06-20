import { GOLD_COST_PER_SUMMON, GOLD_COST_PER_SUMMON_MULTI } from "~/constants/summon";

interface SummonButtonsProps {
  isRateUp?: boolean;
  onSummon: (type: "single" | "multi") => void;
}

export function SummonDesktopButtons({ isRateUp, onSummon }: SummonButtonsProps) {
  return (
    <div className="flex w-full items-center justify-start gap-4">
      {/* Single Summon Button */}
      <button
        onClick={() => onSummon("single")}
        className="bg-bgc-layer1 hover:bg-bgc-layer2 flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-[32px] border border-white px-5 py-3 transition-colors"
      >
        <div className="text-txt-primary justify-center font-sans text-base leading-normal font-bold">
          TRIỆU HỒI
        </div>
        <div className="flex items-center justify-start gap-1.5">
          <img className="h-5 w-6" src="/images/icons/gold-icon.png" alt="Gem" />
          <div className="text-txt-primary justify-center text-center font-sans text-base leading-normal font-semibold">
            {isRateUp ? GOLD_COST_PER_SUMMON.rateUp : GOLD_COST_PER_SUMMON.normal}
          </div>
        </div>
      </button>

      {/* Multi Summon Button */}
      <button
        onClick={() => onSummon("multi")}
        className="flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-[32px] bg-white px-5 py-3 transition-colors hover:bg-gray-100"
      >
        <div className="text-bgc-layer1 justify-center font-sans text-base leading-normal font-bold">
          TRIỆU HỒI X10
        </div>
        <div className="flex items-center justify-start gap-1.5">
          <img className="h-5 w-6" src="/images/icons/gold-icon.png" alt="Gem" />
          <div className="text-bgc-layer1 justify-center text-center font-sans text-base leading-normal font-semibold">
            {isRateUp
              ? GOLD_COST_PER_SUMMON_MULTI.rateUp
              : GOLD_COST_PER_SUMMON_MULTI.normal}
          </div>
        </div>
      </button>
    </div>
  );
}

export function SummonMobileButtons({ isRateUp, onSummon }: SummonButtonsProps) {
  return (
    <div className="flex h-12 w-[410px] items-center justify-start gap-4">
      {/* Single Summon Button */}
      <button
        onClick={() => onSummon("single")}
        className="bg-bgc-layer1 hover:bg-bgc-layer2 flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-[32px] border border-white px-3 py-2 transition-colors"
      >
        <div className="text-txt-primary flex flex-col justify-center font-sans text-sm leading-6 font-bold">
          TRIỆU HỒI
        </div>
        <div className="flex items-center justify-start gap-1.5">
          <img className="h-5 w-6" src="/images/icons/gold-icon.png" alt="Gem" />
          <div className="text-txt-primary flex flex-col justify-center text-center font-sans text-sm leading-6 font-semibold">
            {isRateUp ? GOLD_COST_PER_SUMMON.rateUp : GOLD_COST_PER_SUMMON.normal}
          </div>
        </div>
      </button>

      {/* Multi Summon Button */}
      <button
        onClick={() => onSummon("multi")}
        className="flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-[32px] bg-white px-3 py-2 transition-colors hover:bg-gray-100"
      >
        <div className="text-txt-inverse flex flex-col justify-center font-sans text-sm leading-6 font-bold">
          TRIỆU HỒI X10
        </div>
        <div className="flex items-center justify-start gap-1.5">
          <img className="h-5 w-6" src="/images/icons/gold-icon.png" alt="Gem" />
          <div className="text-txt-inverse flex flex-col justify-center text-center font-sans text-sm leading-6 font-semibold">
            {isRateUp
              ? GOLD_COST_PER_SUMMON_MULTI.rateUp
              : GOLD_COST_PER_SUMMON_MULTI.normal}
          </div>
        </div>
      </button>
    </div>
  );
}
