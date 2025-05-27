export const validateCommentContent = (content: string): boolean => {
  if (!content || typeof content !== "string") {
    return false;
  }

  const trimmed = content.trim();
  return trimmed.length >= 1 && trimmed.length <= 1000;
};

export const sanitizeCommentContent = (content: string): string => {
  return content.trim().replace(/\s+/g, " ");
};
