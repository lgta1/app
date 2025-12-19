import AuthorSelect, { type AuthorLite } from "./author-select";

type Props = {
  initial?: AuthorLite[];
  onChange?: (items: AuthorLite[], orderIds: string[]) => void;
};

export default function TranslatorSelect({ initial = [], onChange }: Props) {
  return (
    <AuthorSelect
      initialAuthors={initial}
      onChange={onChange}
      placeholder="Thêm dịch giả…"
      basePath="/api/translators"
      responseKey="translator"
      createLabelSingular="dịch giả"
    />
  );
}
