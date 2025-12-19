import AuthorSelect, { type AuthorLite } from "./author-select";

type Props = {
  initial?: AuthorLite[];
  onChange?: (items: AuthorLite[], orderIds: string[]) => void;
};

export default function DoujinshiSelect({ initial = [], onChange }: Props) {
  return (
    <AuthorSelect
      initialAuthors={initial}
      onChange={onChange}
      placeholder="Thêm doujinshi…"
      basePath="/api/doujinshi"
      responseKey="doujinshi"
      createLabelSingular="doujinshi"
    />
  );
}
