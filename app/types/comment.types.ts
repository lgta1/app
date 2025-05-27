export interface Comment {
  _id: string;
  content: string;
  mangaId: string;
  userId: {
    _id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CommentPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CommentsResponse {
  comments: Comment[];
  pagination: CommentPagination;
}

export interface CreateCommentData {
  content: string;
  mangaId: string;
  userId: string;
}

export interface DeleteCommentResponse {
  success: boolean;
  message: string;
}
