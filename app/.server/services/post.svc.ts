export const validatePostTitle = (title: string): boolean => {
  if (!title || typeof title !== "string") {
    return false;
  }

  const trimmed = title.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
};

export const validatePostContent = (content: string): boolean => {
  if (!content || typeof content !== "string") {
    return false;
  }

  const trimmed = content.trim();
  return trimmed.length >= 1 && trimmed.length <= 10000;
};

export const validatePostTags = (tags: string[]): boolean => {
  if (!Array.isArray(tags)) {
    return false;
  }

  // Max 10 tags
  if (tags.length > 10) {
    return false;
  }

  // Each tag must be 1-50 characters
  return tags.every((tag) => {
    if (typeof tag !== "string") return false;
    const trimmed = tag.trim();
    return trimmed.length >= 1 && trimmed.length <= 50;
  });
};

export const sanitizePostTitle = (title: string): string => {
  return title.trim().replace(/\s+/g, " ");
};

export const sanitizePostContent = (content: string): string => {
  return content
    .trim()
    .replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space
    .replace(/\n{3,}/g, "\n\n"); // Replace 3+ line breaks with double line break
};

export const sanitizePostTags = (tags: string[]): string[] => {
  return tags
    .map((tag) => tag.trim().replace(/\s+/g, " "))
    .filter((tag) => tag.length > 0)
    .slice(0, 10); // Limit to 10 tags
};
