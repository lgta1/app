import AuthorSelect, { type AuthorLite } from "./author-select";

type Props = {
  initial?: AuthorLite[];
  onChange?: (items: AuthorLite[], orderIds: string[]) => void;
};

export default function CharacterSelect({ initial = [], onChange }: Props) {
  return (
    <AuthorSelect
      initialAuthors={initial}
      onChange={onChange}
      placeholder="Thêm nhân vật…"
      basePath="/api/characters"
      responseKey="character"
      createLabelSingular="nhân vật"
    />
  );
}
